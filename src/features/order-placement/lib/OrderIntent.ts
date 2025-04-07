/**
 * Order intent models
 */
import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import * as borsh from '@coral-xyz/borsh';

export class CancelOrderIntent {
  constructor(
    public readonly order_id: BN,
    public readonly owner: PublicKey,
    public readonly market_id: string
  ) {}

  static layout() {
    return borsh.struct([
      borsh.u64('order_id'),
      borsh.publicKey('owner'),
      borsh.array(borsh.u8(), 16, 'market_id'),
    ]);
  }

  static serialize(cancelOrderIntent: CancelOrderIntent) {
    // Truncate or pad market_id to 16 bytes
    const marketIdBytes = Buffer.from(cancelOrderIntent.market_id);

    const data = {
      order_id: cancelOrderIntent.order_id,
      owner: cancelOrderIntent.owner,
      market_id: marketIdBytes,
    };
    const buffer = Buffer.alloc(1024); // Fixed size: 8 (u64) + 32 (pubkey) + 16 (market_id)
    const encodedLength = CancelOrderIntent.layout().encode(data, buffer);
    return buffer.slice(0, encodedLength);
  }

  static deserialize(buffer: Buffer): CancelOrderIntent {
    const decoded = CancelOrderIntent.layout().decode(buffer);
    console.log('Decoded', decoded);
    return decoded;
  }

  toJSON() {
    return {
      order_id: Number(this.order_id),
      owner: this.owner.toBase58(),
      market_id: this.market_id,
    };
  }
}

export class OrderIntent {
  constructor(
    public readonly order_id: BN,
    public readonly owner: PublicKey,
    public readonly side: 'Buy' | 'Sell',
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
    const sideValue = orderIntent.side === 'Buy' ? 0 : 1;
    const serializable = {
      ...orderIntent,
      side: sideValue,
    };
    OrderIntent.layout().encode(serializable, buffer);
    return buffer;
  }

  static deserialize(buffer: Buffer): OrderIntent {
    const decoded = OrderIntent.layout().decode(buffer);
    // Convert the numeric side back to string

    return {
      ...decoded,
    } as OrderIntent;
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
