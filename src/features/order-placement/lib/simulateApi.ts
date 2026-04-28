import axios from 'axios';
import { API_ROUTES, config } from '@/shared/config/constants';

export interface SimulateMarginSnapshot {
  equity_ui_quote: number;
  init_health_ui_quote: number;
  maint_health_ui_quote: number;
  init_health_ratio: number;
  maint_health_ratio: number;
}

export interface SimulateResponse {
  view: string;
  owner: string;
  mango_account: string;
  cached_age_ms: number;
  snapshot_age_ms: number | null;
  optimistic_overlay_applied: boolean;
  optimistic_markets_applied: string[];
  trade: {
    kind: string;
    market: string;
    market_index: number;
    side: string;
    quantity_ui: number;
    base_lots: string;
    price_ui: number;
    price_source: 'oracle' | 'caller';
    order_type: string;
    reduce_only: boolean;
  };
  before: SimulateMarginSnapshot;
  after: SimulateMarginSnapshot;
  delta: {
    equity_ui_quote: number;
    init_health_ui_quote: number;
    maint_health_ui_quote: number;
  };
  would_reject: boolean;
  reject_reasons: string[];
  warnings: string[];
  compute_ms: number;
}

export interface SimulateRequest {
  owner: string;
  trade: {
    market_index: number;
    side: 'buy' | 'sell';
    quantity: number;
    price?: number;
    order_type: 'limit' | 'market' | 'ioc' | 'postonly' | 'postonlyslide';
    reduce_only?: boolean;
  };
}

export async function warmSimulate(owner: string): Promise<void> {
  await axios.post(`${config.devnet.gatewayUrl}${API_ROUTES.simulate_warm}`, { owner });
}

export async function runSimulate(req: SimulateRequest): Promise<SimulateResponse> {
  const res = await axios.post<SimulateResponse>(
    `${config.devnet.gatewayUrl}${API_ROUTES.simulate}`,
    req
  );
  return res.data;
}
