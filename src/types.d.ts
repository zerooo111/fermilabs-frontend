type Order = {
  owner: string;
  order_id: number;
  price: number;
  quantity: number;
  side: 'Buy' | 'Sell';
  expiry: number;
  base_mint: string;
  quote_mint: string;
  market_id: string;
};

type OrderRow = Order | null;

type Orderbook = {
  buys: Order[];
  sells: Order[];
  lastUpdated: Date;
};

type MarketKind = 'perp';

type PerpConfig = {
  initial_margin: number;
  maintenance_margin: number;
  liquidation_penalty: number;
  max_leverage_tiers: Array<{
    notional: number;
    max_leverage: number;
  }>;
  funding_interval_seconds: number;
  funding_rate_cap_bps: number;
  funding_interest_rate_bps: number;
  funding_premium_cap_bps: number;
  funding_oracle: string | null;
};

type PerpState = {
  mark_price: number | null;
  mark_price_timestamp: number | null;
  index_price: number | null;
  index_price_timestamp: number | null;
  last_premium_rate_bps: number | null;
  last_funding_rate_bps: number | null;
  last_funding_timestamp: number | null;
  next_funding_timestamp: number | null;
};

type Market = {
  uuid: string;
  name: string;
  baseMint: string;
  quoteMint: string;
  created_at: number;
  kind: MarketKind;
  perp_config: PerpConfig | null;
  perp_state: PerpState | null;
};

type GetMarketsResponse = {
  code: 200;
  data: Market[];
  message: string;
};

type GetOrderbookResponse = {
  code: 200;
  data: Orderbook;
  message: string;
};

type PlaceOrderResponse = {
  code: 200;
  data: {
    base_mint: string;
    order_id: bigint;
    quote_mint: string;
    receipt: OrderReceipt;
  };
  message: string;
};

type MarketStats = {
  base_mint: string;
  funding_rate: number;
  mark_price: number;
  market_id: string;
  market_name: string;
  market_type: string;
  open_interest: number;
  quote_mint: string;
};

type GetMarketStatsResponse = {
  code: number;
  data: MarketStats;
  message: string;
};

export interface Server {
  label: string;
  url: string;
  latency: number | null;
}
