import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import * as borsh from '@coral-xyz/borsh';

export enum OrderSide {
  BUY = 'Buy',
  SELL = 'Sell',
}

export class OrderIntent {
  constructor(
    public readonly order_id: BN,
    public readonly owner: PublicKey,
    public readonly side: OrderSide,
    public readonly price: BN,
    public readonly quantity: BN,
    public readonly expiry: BN,
    public readonly base_mint: PublicKey,
    public readonly quote_mint: PublicKey
  ) {}

  static layout(property?: string) {
    return borsh.struct(
      [
        borsh.u64('order_id'),
        borsh.publicKey('owner'),
        borsh.u8('side'),
        borsh.u64('price'),
        borsh.u64('quantity'),
        borsh.u64('expiry'),
        borsh.publicKey('base_mint'),
        borsh.publicKey('quote_mint'),
      ],
      property
    );
  }

  static serialize(orderIntent: OrderIntent) {
    const buffer = Buffer.alloc(OrderIntent.layout().span);
    OrderIntent.layout().encode(orderIntent, buffer);
    console.log('DESERIALISED', JSON.stringify(this.deserialize(buffer), null, 2));
    return buffer;
  }

  static deserialize(buffer: Buffer): OrderIntent {
    const decoded = OrderIntent.layout().decode(buffer);

    console.log(new BN(decoded.quantity).toString());

    return decoded;
  }

  toJSON() {
    return {
      order_id: Number(this.order_id),
      owner: this.owner.toBase58(),
      side: this.side,
      price: Number(this.price),
      quantity: Number(this.quantity),
      expiry: Number(this.expiry),
      base_mint: this.base_mint.toBase58(),
      quote_mint: this.quote_mint.toBase58(),
    };
  }
}
