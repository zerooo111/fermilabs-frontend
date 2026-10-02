import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useWallet } from '@solana/wallet-adapter-react';
import { API_ROUTES, config } from '@/shared/config/constants';
import { useAccountMangoAccount } from '@/shared/hooks/useAccount';

export const TRIGGER_ORDERS_QUERY_KEY = ['trigger-orders'] as const;

export type TriggerOrderState =
  | 'pending'
  | 'armed'
  | 'firing'
  | 'submitted'
  | 'cancelled'
  | 'expired'
  | 'failed'
  | 'fire_unknown';

/** One leg as the keeper reports it (the fields the UI reads). */
export interface TriggerOrder {
  id: string;
  mango_account: string;
  signer: string;
  market_index: number;
  side: 'bid' | 'ask';
  kind: 'stop_loss' | 'take_profit';
  direction: 'at_or_above' | 'at_or_below';
  trigger_price_lots: number;
  limit_price_lots: number;
  max_base_lots: number;
  /** u64 as a decimal string. "0" = not part of a bracket. */
  oco_group: string;
  expiry_ts: number;
  /** The terms commitment, u64 as a decimal string. */
  client_order_id: string;
  state: TriggerOrderState;
  state_reason?: string | null;
  created_ms: number;
  updated_ms: number;
}

const POLL_MS = 5_000;
// Any account works for the probe; the default pubkey has no legs.
const PROBE_ACCOUNT = '11111111111111111111111111111111';

async function fetchActiveTriggerOrders(mangoAccount: string): Promise<TriggerOrder[]> {
  const res = await axios.get<{ orders: TriggerOrder[] }>(
    `${config.devnet.gatewayUrl}${API_ROUTES.trigger_orders}`,
    { params: { mango_account: mangoAccount, active: 'true' } }
  );
  return res.data?.orders ?? [];
}

/**
 * The account's active stop-loss / take-profit legs, newest first. Legs that
 * fired become ordinary orders and leave this list.
 */
export function useTriggerOrders() {
  const { publicKey } = useWallet();
  const { pk: mangoAccount } = useAccountMangoAccount(publicKey?.toBase58());

  return useQuery({
    queryKey: [...TRIGGER_ORDERS_QUERY_KEY, mangoAccount],
    queryFn: () => fetchActiveTriggerOrders(mangoAccount!),
    enabled: !!mangoAccount,
    refetchInterval: POLL_MS,
    staleTime: POLL_MS,
    retry: 1,
  });
}

/**
 * Whether this deployment serves trigger orders (gateway route, bridge proxy
 * and keeper all up). The SL/TP UI stays hidden until it does, so an entry
 * never goes out expecting a stop the backend would refuse.
 */
export function useTriggerOrdersEnabled(): boolean {
  const { data } = useQuery({
    queryKey: [...TRIGGER_ORDERS_QUERY_KEY, 'probe'],
    queryFn: async () => {
      await fetchActiveTriggerOrders(PROBE_ACCOUNT);
      return true;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });
  return data === true;
}

/** The legs protecting one position: same market, closing side. */
export function legsForPosition(
  orders: TriggerOrder[] | undefined,
  marketIndex: number,
  position: 'long' | 'short'
): TriggerOrder[] {
  const side = position === 'long' ? 'ask' : 'bid';
  return (orders ?? []).filter(o => o.market_index === marketIndex && o.side === side);
}
