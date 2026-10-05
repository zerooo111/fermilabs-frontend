/**
 * useOneClick.ts
 * One-click trading: the owner wallet signs one Mango `account_edit` that sets
 * the account's `temporary_delegate` to a browser-held session key for 7 days.
 * Until then the session key signs order intents with no wallet prompt. The
 * delegate can place and cancel orders; it cannot change the delegate or
 * owner, and can only withdraw into the owner's own token account. After the
 * expiry the program stops honouring it, and the user re-enables.
 *
 * One-click is "on" only when the on-chain temporary delegate matches this
 * browser's key and hasn't expired, so a key from another device, a revoked
 * delegation or a lapsed session never signs.
 */
import { useCallback, useEffect } from 'react';
import {
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from '@solana/web3.js';
import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { config } from '@/shared/config/constants';
import { serverConfigAtom } from '@/entities/server';
import { useAccountMangoAccount } from '@/shared/hooks/useAccount';
import { enrichSendError, pollForConfirmation } from '@/shared/hooks/useMangoMarginDeposit';
import { fetchFermiAccountDelegates, getMangoClientAndGroup } from '@/shared/lib/mango-client';
import {
  createSessionKey,
  deleteSessionKey,
  isSessionKeySupported,
  loadSessionKey,
  signWithSessionKey,
  type SessionKey,
} from '../lib/sessionKey';
import {
  buildSetTemporaryDelegateInstruction,
  delegateIntentsEnabled,
  SESSION_DURATION_SECONDS,
} from '../lib/delegation';

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
const balanceQuery = (key: string | undefined) => ['one-click', 'session-balance', key] as const;

// The relayer's margin precheck fetches every remaining account, including the
// signer slot, and rejects the order if one doesn't exist on-chain. A fresh
// session key has no lamports, so it doesn't exist. Funding it with the
// rent-exempt minimum for an empty account makes it exist; turning one-click
// off sweeps the lamports back to the owner.
interface DelegateState {
  delegate: string;
  temporaryDelegate: string;
  /** Unix ms; 0 when unset. */
  expiresAt: number;
  gateOpen: boolean;
}

const fundingLamports = (connection: import('@solana/web3.js').Connection) =>
  connection.getMinimumBalanceForRentExemption(0);

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

  // The account's current on-chain delegates (PublicKey.default when unset),
  // and whether the group currently lets delegates sign intents at all.
  const delegate = useQuery({
    queryKey: delegateQuery(mangoAccountPk),
    queryFn: async (): Promise<DelegateState> => {
      const { client, group } = await getMangoClientAndGroup(connection, serverConfig);
      const onChain = await fetchFermiAccountDelegates(
        client,
        connection,
        new PublicKey(mangoAccountPk!)
      );
      return {
        delegate: onChain.delegate.toBase58(),
        temporaryDelegate: onChain.temporaryDelegate.toBase58(),
        expiresAt: onChain.temporaryDelegateExpiry * 1000,
        gateOpen: delegateIntentsEnabled(group),
      };
    },
    enabled: !!mangoAccountPk,
    staleTime: 60_000,
  });

  const key = sessionKey.data ?? null;

  // Lamports held by this browser's session key (0 = doesn't exist on-chain).
  const keyBalance = useQuery({
    queryKey: balanceQuery(key?.publicKey.toBase58()),
    queryFn: () => connection.getBalance(key!.publicKey, config.devnet.commitment),
    enabled: !!key,
    staleTime: 60_000,
  });

  const expiresAt = delegate.data?.expiresAt ?? 0;
  const active =
    !!key &&
    !!delegate.data?.gateOpen &&
    delegate.data.temporaryDelegate === key.publicKey.toBase58() &&
    expiresAt > Date.now() &&
    (keyBalance.data ?? 0) > 0;

  // Re-read the account when the session lapses so the UI flips to "off"
  // instead of handing out a signer the program would reject.
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(
      () => queryClient.invalidateQueries({ queryKey: delegateQuery(mangoAccountPk) }),
      expiresAt - Date.now()
    );
    return () => clearTimeout(timer);
  }, [active, expiresAt, mangoAccountPk, queryClient]);

  let status: OneClickStatus;
  if (supported.data === false) status = 'unsupported';
  else if (!owner || supported.isLoading || sessionKey.isLoading) status = 'loading';
  else if (!mangoAccountPk) status = 'no-account';
  else if (delegate.isLoading || (!!key && keyBalance.isLoading)) status = 'loading';
  else if (delegate.data && !delegate.data.gateOpen) status = 'unsupported';
  else status = active ? 'on' : 'off';

  /**
   * Owner-signed `account_edit` setting the account's temporary delegate,
   * plus any lamport moves for session keys (which co-sign when they send).
   * Also clears a permanent delegate left over from before sessions expired.
   */
  const setDelegate = useCallback(
    async (
      newDelegate: PublicKey,
      expiresAt: number,
      extra: { before?: TransactionInstruction[]; after?: TransactionInstruction[] } = {},
      sessionSigners: SessionKey[] = []
    ) => {
      if (!anchorWallet || !mangoAccountPk) throw new Error('Wallet or Fermi account missing');
      const { client, group } = await getMangoClientAndGroup(connection, serverConfig);
      const clearPermanent =
        !!delegate.data && delegate.data.delegate !== PublicKey.default.toBase58();
      const ix = await buildSetTemporaryDelegateInstruction({
        connection,
        client,
        group,
        mangoAccount: new PublicKey(mangoAccountPk),
        owner: anchorWallet.publicKey,
        temporaryDelegate: newDelegate,
        expiry: Math.floor(expiresAt / 1000),
        delegate: clearPermanent ? PublicKey.default : undefined,
      });

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(
        config.devnet.commitment
      );
      const tx = new Transaction({
        feePayer: anchorWallet.publicKey,
        recentBlockhash: blockhash,
      }).add(...(extra.before ?? []), ix, ...(extra.after ?? []));
      // Session keys sign first; the wallet keeps existing signatures.
      if (sessionSigners.length) {
        const message = tx.serializeMessage();
        for (const signer of sessionSigners) {
          const signature = await signWithSessionKey(signer, message);
          tx.addSignature(signer.publicKey, Buffer.from(signature));
        }
      }
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
        (prev: DelegateState | undefined): DelegateState => ({
          gateOpen: prev?.gateOpen ?? true,
          delegate: clearPermanent ? PublicKey.default.toBase58() : (prev?.delegate ?? ''),
          temporaryDelegate: newDelegate.toBase58(),
          expiresAt,
        })
      );
      return signature;
    },
    [anchorWallet, mangoAccountPk, connection, serverConfig, queryClient, delegate.data]
  );

  /** Sweep a session key's lamports back to the owner (empty if it holds none). */
  const sweepInstructions = useCallback(
    async (from: SessionKey | null): Promise<TransactionInstruction[]> => {
      if (!from || !publicKey) return [];
      const lamports = await connection.getBalance(from.publicKey, config.devnet.commitment);
      if (lamports <= 0) return [];
      return [
        SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: publicKey, lamports }),
      ];
    },
    [connection, publicKey]
  );

  /** One wallet approval: fund this browser's session key and make it the delegate for 7 days. */
  const enable = useCallback(async () => {
    if (!owner || !publicKey) throw new Error('Wallet not connected');
    const previous = key;
    // A fresh key every time, so an old key (e.g. from a shared machine) is never reused.
    const fresh = await createSessionKey(owner);
    queryClient.setQueryData(keyQuery(owner), fresh);
    const lamports = await fundingLamports(connection);
    const sweep = await sweepInstructions(previous);
    await setDelegate(
      fresh.publicKey,
      Date.now() + SESSION_DURATION_SECONDS * 1000,
      {
        before: [
          SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: fresh.publicKey, lamports }),
          ...sweep,
        ],
      },
      sweep.length && previous ? [previous] : []
    );
    queryClient.setQueryData(balanceQuery(fresh.publicKey.toBase58()), lamports);
  }, [owner, publicKey, key, connection, sweepInstructions, setDelegate, queryClient]);

  /** Revoke on-chain, return the session key's lamports, and forget the local key. */
  const disable = useCallback(async () => {
    if (!owner) return;
    const sweep = await sweepInstructions(key);
    await setDelegate(PublicKey.default, 0, { after: sweep }, sweep.length && key ? [key] : []);
    await deleteSessionKey(owner);
    queryClient.setQueryData(keyQuery(owner), null);
  }, [owner, key, sweepInstructions, setDelegate, queryClient]);

  const intentSigner: IntentSigner | null =
    active && key ? { publicKey: key.publicKey, sign: msg => signWithSessionKey(key, msg) } : null;

  return { status, expiresAt: active ? expiresAt : null, enable, disable, intentSigner };
}

export type { SessionKey };
