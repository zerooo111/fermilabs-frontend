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

type Market = {
  uuid: string;
  name: string;
  baseMint: string;
  quoteMint: string;
  created_at: number;
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
