type Order = {
  owner: string;
  order_id: number;
  price: number;
  quantity: number;
  side: 'Buy' | 'Sell';
  expiry: number;
  base_mint: string;
  quote_mint: string;
};

type OrderRow = Order | null;

type Orderbook = {
  buys: Order[];
  sells: Order[];
  lastUpdated: Date;
};
