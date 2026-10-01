/**
 * useOneClick.ts
 * One-click trading: the owner wallet signs one Mango `account_edit` that sets
 * the account's `delegate` to a browser-held session key. From then on the
 * session key signs order intents with no wallet prompt. The delegate can
 * place and cancel orders; it cannot change the delegate or owner, and can
 * only withdraw into the owner's own token account.
 *
 * One-click is "on" only when the on-chain delegate matches this browser's
 * key, so a key from another device or a revoked delegation never signs.
 */
import { useCallback } from 'react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { config } from '@/shared/config/constants';
import { serverConfigAtom } from '@/entities/server';
import { useAccountMangoAccount } from '@/shared/hooks/useAccount';
import { enrichSendError, pollForConfirmation } from '@/shared/hooks/useMangoMarginDeposit';
import { fetchFermiAccount, getMangoClientAndGroup } from '@/shared/lib/mango-client';
import {
  createSessionKey,
  deleteSessionKey,
  isSessionKeySupported,
  loadSessionKey,
  signWithSessionKey,
  type SessionKey,
} from '../lib/sessionKey';
import { buildSetDelegateInstruction, delegateIntentsEnabled } from '../lib/delegation';

export type OneClickStatus =
  | 'loading'
  | 'unsupported' // browser lacks WebCrypto Ed25519, or the group gate is closed
  | 'no-account' // no Fermi account yet (deposit first)
  | 'off'
  | 'on';

/** Signs order intents in place of the owner wallet. */
export interface IntentSigner {
  publicKey: PublicKey;
  sign: (message: Uint8Array) => Promise<Uint8Array>;
}

const keyQuery = (owner: string | undefined) => ['one-click', 'session-key', owner] as const;
const delegateQuery = (account: string | null) => ['one-click', 'delegate', account] as const;

export function useOneClick() {
  const { publicKey } = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const serverConfig = useAtomValue(serverConfigAtom);
  const owner = publicKey?.toBase58();
  const { pk: mangoAccountPk } = useAccountMangoAccount(owner);

  const supported = useQuery({
    queryKey: ['one-click', 'supported'],
    queryFn: isSessionKeySupported,
    staleTime: Infinity,
  });

  const sessionKey = useQuery({
    queryKey: keyQuery(owner),
    queryFn: () => loadSessionKey(owner!),
    enabled: !!owner && supported.data === true,
    staleTime: Infinity,
  });

  // The account's current on-chain delegate (PublicKey.default when unset),
  // and whether the group currently lets delegates sign intents at all.
  const delegate = useQuery({
    queryKey: delegateQuery(mangoAccountPk),
    queryFn: async () => {
      const { client, group } = await getMangoClientAndGroup(connection, serverConfig);
      const account = await fetchFermiAccount(client, connection, new PublicKey(mangoAccountPk!));
      return { delegate: account.delegate.toBase58(), gateOpen: delegateIntentsEnabled(group) };
    },
    enabled: !!mangoAccountPk,
    staleTime: 60_000,
  });

  const key = sessionKey.data ?? null;
  const active =
    !!key && !!delegate.data?.gateOpen && delegate.data.delegate === key.publicKey.toBase58();

  let status: OneClickStatus;
  if (supported.data === false) status = 'unsupported';
  else if (!owner || supported.isLoading || sessionKey.isLoading) status = 'loading';
  else if (!mangoAccountPk) status = 'no-account';
  else if (delegate.isLoading) status = 'loading';
  else if (delegate.data && !delegate.data.gateOpen) status = 'unsupported';
  else status = active ? 'on' : 'off';

  /** Owner-signed `account_edit` setting the account delegate. */
  const setDelegate = useCallback(
    async (newDelegate: PublicKey) => {
      if (!anchorWallet || !mangoAccountPk) throw new Error('Wallet or Fermi account missing');
      const { client, group } = await getMangoClientAndGroup(connection, serverConfig);
      const ix = await buildSetDelegateInstruction({
        connection,
        client,
        group,
        mangoAccount: new PublicKey(mangoAccountPk),
        owner: anchorWallet.publicKey,
        delegate: newDelegate,
      });

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(
        config.devnet.commitment
      );
      const tx = new Transaction({
        feePayer: anchorWallet.publicKey,
        recentBlockhash: blockhash,
      }).add(ix);
      const signed = await anchorWallet.signTransaction(tx);

      let signature: string;
      try {
        signature = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: true,
          maxRetries: 10,
        });
      } catch (err) {
        throw await enrichSendError(err);
      }
      const confirmed = await pollForConfirmation(
        connection,
        signature,
        lastValidBlockHeight,
        config.devnet.commitment
      );
      if (!confirmed) throw new Error('Transaction was not confirmed. Please try again.');

      queryClient.setQueryData(
        delegateQuery(mangoAccountPk),
        (prev: { delegate: string; gateOpen: boolean } | undefined) => ({
          gateOpen: prev?.gateOpen ?? true,
          delegate: newDelegate.toBase58(),
        })
      );
      return signature;
    },
    [anchorWallet, mangoAccountPk, connection, serverConfig, queryClient]
  );

  /** One wallet approval: delegate the account to this browser's session key. */
  const enable = useCallback(async () => {
    if (!owner) throw new Error('Wallet not connected');
    // A fresh key every time, so an old key (e.g. from a shared machine) is never reused.
    const fresh = await createSessionKey(owner);
    queryClient.setQueryData(keyQuery(owner), fresh);
    await setDelegate(fresh.publicKey);
  }, [owner, setDelegate, queryClient]);

  /** Revoke on-chain (delegate = default pubkey) and forget the local key. */
  const disable = useCallback(async () => {
    if (!owner) return;
    await setDelegate(PublicKey.default);
    await deleteSessionKey(owner);
    queryClient.setQueryData(keyQuery(owner), null);
  }, [owner, setDelegate, queryClient]);

  const intentSigner: IntentSigner | null =
    active && key ? { publicKey: key.publicKey, sign: msg => signWithSessionKey(key, msg) } : null;

  return { status, enable, disable, intentSigner };
}

export type { SessionKey };
