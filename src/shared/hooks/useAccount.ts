import { useAtomValue } from 'jotai';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { accountMetricsAtom } from '@/shared/api/sse-atoms';
import { config, API_ROUTES, API_ROUTES_V2 } from '@/shared/config/constants';
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

// ── Canonical v2 account snapshot ────────────────────────────────────
//
// One consumer-boundary endpoint (`/v2/snapshot/account/:owner`) fetched via
// TanStack Query. All typed selectors share the same query key so a single
// HTTP fetch is deduped across every hook variant.
//
// Design intent: v2 endpoints map to consumer concerns, not Redis keys. A
// user's account panel renders balance + positions + orders + margin
// together — that's one concern, one fetch. Selectors below extract the
// slice each caller needs without extra network traffic.

export interface V2AccountSnapshot {
  owner: string;
  view: 'opt' | 'conf';
  /** Asset-keyed balance hash. Currently empty on the v2 path — the harness
   *  mirror only writes summary + ts_ms into `v1:balance:<owner>` today.
   *  Will populate once the harness team ships per-asset token mirroring. */
  balances: Record<string, string>;
  margin_summary: {
    source?: string;
    status?: string;
    account_count?: number;
    accounts?: Array<{
      mango_account: string;
      owner?: string;
      equity_native_quote?: string;
      assets_native_quote?: string;
      liabs_native_quote?: string;
      init_health_native_quote?: string;
      maint_health_native_quote?: string;
      init_health_ratio?: string;
      maint_health_ratio?: string;
      margin_usage_fraction?: number;
    }>;
    totals?: {
      equity_native_quote?: string;
      pnl_native_quote?: string;
      assets_native_quote?: string;
      liabs_native_quote?: string;
      init_health_native_quote?: string;
      maint_health_native_quote?: string;
      margin_usage_fraction?: number;
    };
  } | null;
  positions: Array<{
    market: string;
    fields: {
      base?: string;
      quote?: string;
      open_bid?: string;
      open_ask?: string;
      reserved?: string;
      ts_ms?: string;
    };
  }>;
  orders: Array<{
    order_id: string;
    market: string;
    order: {
      owner?: string;
      price?: string;
      size?: string;
      side?: 'bid' | 'ask';
      ts_ms?: number | string;
      client_id?: string | number | null;
    } | null;
  }>;
}

async function fetchV2AccountSnapshot(owner: string): Promise<V2AccountSnapshot> {
  const path = API_ROUTES_V2.snapshot_account.replace('{owner}', encodeURIComponent(owner));
  const { data } = await axios.get<V2AccountSnapshot>(
    `${config.devnet.gatewayUrl}${path}?view=optimistic`
  );
  return data;
}

/**
 * Canonical hook — every other account-related hook below is a selector on
 * top of this one. TanStack Query dedupes the underlying fetch by key so
 * N component consumers produce at most one network request per refetch
 * interval.
 */
export function useV2Account(owner: string | null | undefined) {
  return useQuery({
    queryKey: ['v2-account', owner],
    queryFn: () => fetchV2AccountSnapshot(owner!),
    enabled: !!owner && config.devnet.useV2ReadLayer,
    refetchInterval: 5_000,
    // Live updates arrive via the composite SSE stream — the query is just a
    // cold-load / refresh fallback for panels that aren't mounted inside a
    // page that also runs useSSEStream.
    staleTime: 2_000,
  });
}

/** First (and usually only) mango account owned by this wallet.
 *  Returns { pk, isLoading } so callers can distinguish "still fetching"
 *  from "confirmed no account". Works on both v2 and v1 read paths. */
export function useAccountMangoAccount(owner: string | null | undefined): {
  pk: string | null;
  isLoading: boolean;
} {
  const v2 = useV2Account(owner);

  // v1 fallback: deposit-context endpoint carries mango_account on every env.
  const v1 = useQuery({
    queryKey: ['deposit-context-mango', owner],
    queryFn: async () => {
      const { data } = await axios.get<{ mango_account?: string; mango_account_exists?: boolean }>(
        `${config.devnet.gatewayUrl}${API_ROUTES.deposit_context.replace('{pubkey}', owner!)}`
      );
      return data.mango_account ?? null;
    },
    enabled: !!owner && !config.devnet.useV2ReadLayer,
    staleTime: 30_000,
    refetchInterval: false,
  });

  if (config.devnet.useV2ReadLayer) {
    return {
      pk: v2.data?.margin_summary?.accounts?.[0]?.mango_account ?? null,
      isLoading: v2.isLoading,
    };
  }
  return { pk: v1.data ?? null, isLoading: v1.isLoading };
}

/** MarginAccount (derived from margin_summary.totals — quote-decimals are
 *  6 in v2 across all SPL collateral). */
export function useAccountMarginAccount(
  owner: string | null | undefined,
  quoteDecimals = 6
): MarginAccount | null {
  const q = useV2Account(owner);
  if (!q.data) return null;
  const totals = q.data.margin_summary?.totals ?? {};
  const scale = Math.pow(10, quoteDecimals);
  const toUi = (v?: string) => (v === undefined ? 0 : Number(v) / scale);
  const equity = toUi(totals.equity_native_quote);
  const assets = toUi(totals.assets_native_quote);
  const liabs = toUi(totals.liabs_native_quote);
  const initHealth = toUi(totals.init_health_native_quote);
  const maintHealth = toUi(totals.maint_health_native_quote);
  const unrealizedPnl = toUi(totals.pnl_native_quote);
  const equityOrAssets = equity !== 0 ? equity : assets;
  return {
    owner: q.data.owner,
    usdc_collateral: equity,
    positions: [],
    reservations: [],
    realized_pnl_total: 0,
    equity_snapshot: equity,
    realized_pnl_snapshot: 0,
    unrealized_pnl: unrealizedPnl,
    funding_accrued_snapshot: 0,
    initial_margin_snapshot: Math.max(equityOrAssets - initHealth, 0),
    maintenance_margin_snapshot: Math.max(equityOrAssets - maintHealth, 0),
    free_collateral_snapshot: Math.max(initHealth, 0),
    available_withdrawal_snapshot: Math.max(initHealth, 0),
    per_market_delta_snapshot: [],
    portfolio_leverage_limit_snapshot: 0,
    margin_usage_fraction:
      typeof totals.margin_usage_fraction === 'number'
        ? totals.margin_usage_fraction
        : assets > 0
          ? Math.max(liabs / assets, 0)
          : 0,
  };
}

// ── Legacy SSE-fed hook ──────────────────────────────────────────────
// Existing consumers read from the jotai atom populated by the composite
// stream's `account` event. Retained unchanged for backwards compatibility;
// new code should prefer useV2Account + selectors above so the data source
// is explicit and TanStack Query handles refresh/invalidation.
//
// owner param preserved for API compat — atom is scoped to connected wallet.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useAccount(owner: string) {
  const data = useAtomValue(accountMetricsAtom);
  return { data, isLoading: false, isError: false, error: null };
}
