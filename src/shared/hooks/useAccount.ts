import { useAtomValue } from 'jotai';
import { accountMetricsAtom } from '@/shared/api/sse-atoms';
import { Position } from './usePositions';

export interface MarginReservation {
  order_id: number;
  initial_margin_delta: number;
  maintenance_margin_delta: number;
}

export interface MarginAccount {
  owner: string;
  usdc_collateral: number;
  positions: Position[];
  reservations: MarginReservation[];
  realized_pnl_total: number;
  equity_snapshot: number;
  realized_pnl_snapshot: number;
  unrealized_pnl: number;
  funding_accrued_snapshot: number;
  initial_margin_snapshot: number;
  maintenance_margin_snapshot: number;
  free_collateral_snapshot: number;
  available_withdrawal_snapshot: number;
  per_market_delta_snapshot: unknown[];
  portfolio_leverage_limit_snapshot: number;
  margin_usage_fraction: number;
}

// owner param preserved for API compat — SSE stream is scoped to connected wallet
export function useAccount(owner: string) {
  // eslint-disable-line @typescript-eslint/no-unused-vars
  const data = useAtomValue(accountMetricsAtom);
  return { data, isLoading: false, isError: false, error: null };
}
