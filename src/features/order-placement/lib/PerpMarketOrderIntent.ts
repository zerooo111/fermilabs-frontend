import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import * as borsh from '@coral-xyz/borsh';
import type { OrderSide, MarketKind, PositionEffect, MarginMode } from './PerpLimitOrderIntent';

export class PerpMarketOrderIntent {
  constructor(
    public readonly order_id: BN,
    public readonly owner: PublicKey,
    public readonly side: OrderSide,
    public readonly quantity: BN,
    public readonly expiry: BN,
    public readonly base_mint: PublicKey,
    public readonly quote_mint: PublicKey,
    public readonly market_kind: MarketKind,
    public readonly leverage: BN | null,
    public readonly position_effect: PositionEffect | null,
    public readonly reduce_only: boolean,
    public readonly margin_mode: MarginMode | null,
    public readonly liquidation: boolean,
    public readonly max_slippage_bps: number,
    public readonly market_id: string | null,
    public readonly stop_loss_price: BN | null,
    public readonly take_profit_price: BN | null
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
        borsh.option(borsh.u64(), 'stop_loss_price'),
        borsh.option(borsh.u64(), 'take_profit_price'),
      ],
      property
    );
  }

  static serialize(intent: PerpMarketOrderIntent) {
    const sideValue = intent.side === 'Buy' ? 0 : 1;
    const marketKindValue = intent.market_kind === 'perp' ? 1 : 0;

    const positionEffectValue =
      intent.position_effect === null ? null : intent.position_effect === 'open' ? 0 : 1;

    const marginModeValue =
      intent.margin_mode === null ? null : intent.margin_mode === 'isolated' ? 1 : 0;

    const serializable = {
      order_id: intent.order_id,
      owner: intent.owner,
      side: sideValue,
      price: new BN(0), // Market orders always use price=0
      quantity: intent.quantity,
      expiry: intent.expiry,
      base_mint: intent.base_mint,
      quote_mint: intent.quote_mint,
      market_kind: marketKindValue,
      leverage: intent.leverage,
      position_effect: positionEffectValue,
      reduce_only: intent.reduce_only,
      margin_mode: marginModeValue,
      margin_amount: null, // Not needed for market orders; engine computes from fill
      liquidation: intent.liquidation,
      stop_loss_price: intent.stop_loss_price,
      take_profit_price: intent.take_profit_price,
    };

    const tempBuffer = Buffer.alloc(1024);
    const layout = PerpMarketOrderIntent.layout();
    const span = layout.encode(serializable, tempBuffer);
    const resultBuffer = tempBuffer.subarray(0, span);

    return resultBuffer;
  }

  toJSON() {
    return {
      order_id: Number(this.order_id),
      owner: this.owner.toBase58(),
      side: this.side,
      price: 0, // Market orders always use price=0
      quantity: Number(this.quantity),
      expiry: Number(this.expiry),
      base_mint: this.base_mint.toBase58(),
      quote_mint: this.quote_mint.toBase58(),
      market_kind: 'perp' as const,
      leverage: this.leverage ? Number(this.leverage) : null,
      position_effect: this.position_effect
        ? this.position_effect === 'open'
          ? 'open'
          : 'close'
        : null,
      reduce_only: this.reduce_only,
      margin_mode: this.margin_mode ? (this.margin_mode === 'cross' ? 'cross' : 'isolated') : null,
      margin_amount: null, // Not needed for market orders
      liquidation: this.liquidation,
      stop_loss_price: this.stop_loss_price ? Number(this.stop_loss_price) : null,
      take_profit_price: this.take_profit_price ? Number(this.take_profit_price) : null,
      order_type: 'market' as const,
      max_slippage_bps: this.max_slippage_bps,
      market_id: this.market_id,
    };
  }
}
