import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createFeeClient, type FeeStatus } from '@/shared/api/fees';
import { useAccountMangoAccount } from '@/shared/hooks/useAccount';

export const FEE_STATUS_QUERY_KEY = (owner: string | undefined, mangoAccount: string | undefined) =>
  ['fee-status', owner, mangoAccount] as const;

export type FeeHealth = 'ok' | 'warn' | 'danger' | 'unknown';

export function computeFeeHealth(data: FeeStatus | undefined): FeeHealth {
  if (!data) return 'unknown';
  const available = data.fee_account.available_balance_lamports;
  const quoted = data.quote.quoted_fee_lamports;
  if (!data.ok || (quoted > 0 && available < quoted)) return 'danger';
  if (quoted > 0 && available < quoted * 2) return 'warn';
  return 'ok';
}

export function formatSolFromLamports(lamports: number | null | undefined): string {
  if (lamports === null || lamports === undefined) return '—';
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

export function useFeeStatus(options?: { refetchInterval?: number }) {
  const { publicKey } = useWallet();
  const { pk: mangoAccountPk } = useAccountMangoAccount(publicKey?.toBase58());
  const feeClient = useMemo(() => createFeeClient(), []);

  const query = useQuery<FeeStatus>({
    queryKey: FEE_STATUS_QUERY_KEY(publicKey?.toBase58(), mangoAccountPk ?? undefined),
    queryFn: () =>
      feeClient.getStatus({
        userOwner: publicKey!.toBase58(),
        mangoAccount: mangoAccountPk!,
      }),
    enabled: !!publicKey && !!mangoAccountPk,
    refetchInterval: options?.refetchInterval ?? 30_000,
    staleTime: 5_000,
  });

  return {
    ...query,
    mangoAccountPk,
    health: computeFeeHealth(query.data),
  };
}
