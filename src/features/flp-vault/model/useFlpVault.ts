/**
 * On-chain FLP reads: the vault, its share mint and escrow, and the connected
 * wallet's quote/share balances. Account subscriptions invalidate the queries
 * so the view reconciles with chain state rather than an optimistic cache.
 */
import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import type { BN } from '@coral-xyz/anchor';

import { FlpClient, STATUS, TOKEN_2022_PROGRAM_ID, vaultMode, type VaultAccount } from '../sdk';
import { FLP_PROGRAM_ID, FLP_RPC_URL, FLP_VAULT } from './config';

const COMMITMENT = 'confirmed' as const;

let shared: { connection: Connection; client: FlpClient } | null = null;
export function getFlp() {
  if (!shared) {
    const connection = new Connection(FLP_RPC_URL, COMMITMENT);
    shared = { connection, client: new FlpClient(connection, FLP_PROGRAM_ID) };
  }
  return shared;
}

export const flpKeys = {
  vault: ['flp', 'vault', FLP_VAULT.toBase58()] as const,
  user: (owner: string) => ['flp', 'user', FLP_VAULT.toBase58(), owner] as const,
};

const big = (n: BN | unknown) => BigInt((n as BN).toString());

export interface FlpVaultView {
  state: VaultAccount;
  mode: ReturnType<typeof vaultMode>;
  depositsOpen: boolean;
  withdrawalsOpen: boolean;
  quoteDecimals: number;
  shareDecimals: number;
  shareSupply: bigint;
  escrowBalance: bigint;
  tvlCap: bigint;
  minDeposit: bigint;
  minWithdrawShares: bigint;
}

async function readVault(): Promise<FlpVaultView> {
  const { connection, client } = getFlp();
  const state = await client.fetchVault(FLP_VAULT);
  const [quote, shares, escrow] = await Promise.all([
    connection.getTokenSupply(state.quoteMint, COMMITMENT),
    connection.getTokenSupply(state.shareMint, COMMITMENT),
    connection.getTokenAccountBalance(state.depositEscrow, COMMITMENT),
  ]);
  const mode = vaultMode(state.status);
  return {
    state,
    mode,
    depositsOpen:
      !(state.status & (STATUS.depositsPaused | STATUS.breaker)) &&
      (mode === 'pre-deposit' || mode === 'live'),
    withdrawalsOpen: !(state.status & STATUS.withdrawalsPaused),
    quoteDecimals: quote.value.decimals,
    shareDecimals: shares.value.decimals,
    shareSupply: BigInt(shares.value.amount),
    escrowBalance: BigInt(escrow.value.amount),
    tvlCap: big(state.params.tvlCap),
    minDeposit: big(state.params.minDeposit),
    minWithdrawShares: big(state.params.minWithdrawShares),
  };
}

export interface FlpUserView {
  quoteAta: PublicKey;
  quoteAtaExists: boolean;
  quoteBalance: bigint;
  shareAta: PublicKey;
  shareBalance: bigint;
}

async function tokenBalance(connection: Connection, ata: PublicKey) {
  const info = await connection.getAccountInfo(ata, COMMITMENT);
  if (!info) return { exists: false, amount: 0n };
  const { value } = await connection.getTokenAccountBalance(ata, COMMITMENT);
  return { exists: true, amount: BigInt(value.amount) };
}

async function readUser(vault: FlpVaultView, owner: PublicKey): Promise<FlpUserView> {
  const { connection } = getFlp();
  const quoteAta = getAssociatedTokenAddressSync(vault.state.quoteMint, owner);
  const shareAta = getAssociatedTokenAddressSync(
    vault.state.shareMint,
    owner,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  const [quote, share] = await Promise.all([
    tokenBalance(connection, quoteAta),
    tokenBalance(connection, shareAta),
  ]);
  return {
    quoteAta,
    quoteAtaExists: quote.exists,
    quoteBalance: quote.amount,
    shareAta,
    shareBalance: share.amount,
  };
}

export function useFlpVault() {
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();
  const owner = publicKey?.toBase58() ?? null;

  const vault = useQuery({
    queryKey: flpKeys.vault,
    queryFn: readVault,
    refetchInterval: 30_000,
  });

  const user = useQuery({
    queryKey: flpKeys.user(owner ?? ''),
    queryFn: () => readUser(vault.data!, publicKey!),
    enabled: !!owner && !!vault.data,
    refetchInterval: 30_000,
  });

  const vaultAccounts = useMemo(
    () => (vault.data ? [FLP_VAULT, vault.data.state.depositEscrow] : []),
    // Addresses are fixed for a vault; resubscribe only when it first loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [!!vault.data]
  );
  const userAccounts = useMemo(
    () => (user.data ? [user.data.quoteAta, user.data.shareAta] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owner, !!user.data]
  );

  useEffect(() => {
    const { connection } = getFlp();
    const ids = [
      ...vaultAccounts.map(a =>
        connection.onAccountChange(
          a,
          () => queryClient.invalidateQueries({ queryKey: flpKeys.vault }),
          COMMITMENT
        )
      ),
      ...userAccounts.map(a =>
        connection.onAccountChange(
          a,
          () => owner && queryClient.invalidateQueries({ queryKey: flpKeys.user(owner) }),
          COMMITMENT
        )
      ),
    ];
    return () => {
      ids.forEach(id => void connection.removeAccountChangeListener(id));
    };
  }, [vaultAccounts, userAccounts, owner, queryClient]);

  return { vault, user, owner };
}
