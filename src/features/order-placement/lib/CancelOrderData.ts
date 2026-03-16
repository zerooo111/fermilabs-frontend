import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import * as borsh from '@coral-xyz/borsh';

export class CancelOrderData {
  constructor(
    public readonly order_id: BN,
    public readonly owner: PublicKey,
    public readonly base_mint: PublicKey,
    public readonly quote_mint: PublicKey
  ) {}

  static layout(property?: string) {
    return borsh.struct(
      [
        borsh.u64('order_id'),
        borsh.publicKey('owner'),
        borsh.publicKey('base_mint'),
        borsh.publicKey('quote_mint'),
      ],
      property
    );
  }

  static serialize(data: CancelOrderData): Buffer {
    const buffer = Buffer.alloc(CancelOrderData.layout().span);
    CancelOrderData.layout().encode(data, buffer);
    return buffer;
  }

  toJSON() {
    return {
      order_id: Number(this.order_id),
      owner: this.owner.toBase58(),
      base_mint: this.base_mint.toBase58(),
      quote_mint: this.quote_mint.toBase58(),
    };
  }
}
