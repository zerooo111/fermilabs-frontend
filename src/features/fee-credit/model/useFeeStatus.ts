import { useQuery } from '@tanstack/react-query';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createFeeClient, type FeeStatus } from '@/shared/api/fees';
import { useAccountMangoAccount } from '@/shared/hooks/useAccount';
import { useAccessOwner } from '@/features/access-gate';

const feeClient = createFeeClient();

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
  const owner = useAccessOwner();
  const { pk: mangoAccountPk } = useAccountMangoAccount(owner);

  const query = useQuery<FeeStatus>({
    queryKey: FEE_STATUS_QUERY_KEY(owner ?? undefined, mangoAccountPk ?? undefined),
    queryFn: () =>
      feeClient.getStatus({
        userOwner: owner!,
        mangoAccount: mangoAccountPk!,
      }),
    enabled: !!owner && !!mangoAccountPk,
    refetchInterval: options?.refetchInterval ?? 30_000,
    staleTime: 5_000,
  });

  return {
    ...query,
    mangoAccountPk,
    health: computeFeeHealth(query.data),
  };
}
