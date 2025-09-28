import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import * as borsh from '@coral-xyz/borsh';

export type OrderSide = 'Buy' | 'Sell';
export type MarketKind = 'perp';
export type PositionEffect = 'open' | 'close';
export type MarginMode = 'isolated' | 'cross';

export class PerpOrderIntent {
  constructor(
    public readonly order_id: BN,
    public readonly owner: PublicKey,
    public readonly side: OrderSide,
    public readonly price: BN,
    public readonly quantity: BN,
    public readonly expiry: BN,
    public readonly base_mint: PublicKey,
    public readonly quote_mint: PublicKey,
    public readonly market_kind: MarketKind,
    public readonly leverage: BN | null,
    public readonly position_effect: PositionEffect | null,
    public readonly reduce_only: boolean,
    public readonly margin_mode: MarginMode | null,
    public readonly margin_amount: BN | null,
    public readonly liquidation: boolean
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
        borsh.u8('market_kind'),
        borsh.option(borsh.u64(), 'leverage'),
        borsh.option(borsh.u8(), 'position_effect'),
        borsh.bool('reduce_only'),
        borsh.option(borsh.u8(), 'margin_mode'),
        borsh.option(borsh.u64(), 'margin_amount'),
        borsh.bool('liquidation'),
      ],
      property
    );
  }

  static serialize(intent: PerpOrderIntent) {
    const sideValue = intent.side === 'Buy' ? 0 : 1;
    // Rust MarketKind enum order is: Spot=0, Perp=1
    const marketKindValue = intent.market_kind === 'perp' ? 1 : 0;

    const positionEffectValue =
      intent.position_effect === null ? null : intent.position_effect === 'open' ? 0 : 1;

    // Rust MarginMode enum order is: Cross=0, Isolated=1
    const marginModeValue =
      intent.margin_mode === null ? null : intent.margin_mode === 'isolated' ? 1 : 0;

    const serializable = {
      order_id: intent.order_id,
      owner: intent.owner,
      side: sideValue,
      price: intent.price,
      quantity: intent.quantity,
      expiry: intent.expiry,
      base_mint: intent.base_mint,
      quote_mint: intent.quote_mint,
      market_kind: marketKindValue,
      leverage: intent.leverage,
      position_effect: positionEffectValue,
      reduce_only: intent.reduce_only,
      margin_mode: marginModeValue,
      margin_amount: intent.margin_amount,
      liquidation: intent.liquidation,
    };

    // Since borsh.option() creates variable-size structures, we need to encode first
    // to determine the actual size, then return the properly sized buffer
    const tempBuffer = Buffer.alloc(1024); // Large enough buffer for any perp order
    const layout = PerpOrderIntent.layout();
    const span = layout.encode(serializable, tempBuffer);
    const resultBuffer = tempBuffer.subarray(0, span);

    return resultBuffer;
  }

  static deserialize(buffer: Buffer): PerpOrderIntent {
    const decoded = PerpOrderIntent.layout().decode(buffer);

    // Convert numeric values back to strings
    const side = decoded.side === 0 ? 'Buy' : 'Sell';
    const market_kind: MarketKind = 'perp'; // Only 'Perp' for now
    const position_effect =
      decoded.position_effect === null ? null : decoded.position_effect === 0 ? 'open' : 'close';
    const margin_mode =
      decoded.margin_mode === null ? null : decoded.margin_mode === 0 ? 'cross' : 'isolated';

    return new PerpOrderIntent(
      decoded.order_id,
      decoded.owner,
      side,
      decoded.price,
      decoded.quantity,
      decoded.expiry,
      decoded.base_mint,
      decoded.quote_mint,
      market_kind,
      decoded.leverage,
      position_effect,
      decoded.reduce_only,
      margin_mode,
      decoded.margin_amount,
      decoded.liquidation
    );
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
      // Server expects lowercase "perp" in DTO
      market_kind: 'perp',
      leverage: this.leverage ? Number(this.leverage) : null,
      // Server expects lowercase strings for these option fields
      position_effect: this.position_effect
        ? this.position_effect === 'open'
          ? 'open'
          : 'close'
        : null,
      reduce_only: this.reduce_only,
      margin_mode: this.margin_mode ? (this.margin_mode === 'cross' ? 'cross' : 'isolated') : null,
      margin_amount: this.margin_amount ? Number(this.margin_amount) : null,
      liquidation: this.liquidation,
    };
  }
}
