/**
 * Pre-flight for a quick-order basket.
 *
 * The protocol has no cross-market atomic submit, so the strongest promise we
 * can keep is this: price every leg, size it against the market's lots, add up
 * the margin, and refuse the whole basket before anything is signed if one leg
 * cannot go. Checks mirror the trade ticket (margin-calculator, free
 * collateral, fee credit) so a basket is accepted on the same terms as a
 * single order.
 */
import { useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue } from 'jotai';
import { accountMetricsAtom } from '@/shared/api/sse-atoms';
import { calculatePerpMargin } from '@/shared/lib/margin-calculator';
import { uiBaseToLots } from '@/shared/lib/mango-execution-queue';
import { serverConfigAtom } from '@/entities/server';
import { useFeeStatus } from '@/features/fee-credit';
import { marketRiskLimits } from '@/features/order-placement/lib/useOrderForm';
import { useOneClick } from '@/features/one-click';
import { describeLeg, type QuickOrderLeg } from './parse';
import type { QuickOrderMarketInfo } from './useQuickOrderMarkets';

export interface BasketLegPlan {
  leg: QuickOrderLeg;
  /** Mark price used for the notional and the slippage-bounded limit. */
  markPrice: number | null;
  notional: number;
  marginRequired: number;
  maxLeverage: number;
  /** Why this leg cannot be sent, or null. */
  problem: string | null;
}

export interface BasketPlan {
  legs: BasketLegPlan[];
  totalNotional: number;
  totalMargin: number;
  freeCollateral: number;
  /** Everything that blocks the basket, in the order it should be read. */
  blockers: string[];
  /** Wallet prompts the user will see; 0 when one-click signs locally. */
  walletApprovals: number;
  feeCreditLow: boolean;
  canSubmit: boolean;
}

const usd = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Init margin for one leg, in quote units, the way the trade ticket does it. */
function legMargin(
  info: QuickOrderMarketInfo,
  size: number,
  price: number,
  maxLeverage: number
): number | null {
  const baseDecimals = info.market.base_decimals;
  const quoteDecimals = info.market.quote_decimals;
  try {
    const result = calculatePerpMargin({
      price: Math.floor(price * 10 ** quoteDecimals),
      quantity: Math.floor(size * 10 ** baseDecimals),
      leverage: maxLeverage,
      marketInitialMarginBps: info.market.perp_config?.initial_margin || 0,
    });
    return Number(result.requiredMargin) / 10 ** (baseDecimals + quoteDecimals);
  } catch {
    return null;
  }
}

export function useBasketPlan(legs: QuickOrderLeg[], markets: QuickOrderMarketInfo[]): BasketPlan {
  const { publicKey } = useWallet();
  const serverConfig = useAtomValue(serverConfigAtom);
  const accountMetrics = useAtomValue(accountMetricsAtom);
  const feeStatus = useFeeStatus();
  const { intentSigner } = useOneClick();

  const feeInsufficient = !!publicKey && feeStatus.isSuccess && !feeStatus.data?.ok;
  const freeCollateral = accountMetrics?.free_collateral_snapshot ?? 0;
  const oneClick = !!intentSigner;

  return useMemo(() => {
    const planned = legs.map<BasketLegPlan>(leg => {
      const info = markets.find(m => m.id === leg.market.id);
      const risk = serverConfig?.markets.find(m => m.market_index === Number(leg.market.id))?.risk;
      const { maxLeverage } = marketRiskLimits(risk);

      if (!info) {
        return {
          leg,
          markPrice: null,
          notional: 0,
          marginRequired: 0,
          maxLeverage,
          problem: `${leg.market.base} is no longer listed`,
        };
      }

      const markPrice = info.markPrice;
      if (markPrice === null) {
        return {
          leg,
          markPrice: null,
          notional: 0,
          marginRequired: 0,
          maxLeverage,
          problem: `No mark price for ${info.base} yet`,
        };
      }

      // Below one lot the order rounds to nothing on chain.
      const lots = uiBaseToLots({
        uiQuantity: leg.size,
        baseDecimals: info.market.base_decimals,
        baseLotSize: info.market.base_lot_size,
      });
      if (lots <= 0n) {
        const minSize = info.market.base_lot_size / 10 ** info.market.base_decimals;
        return {
          leg,
          markPrice,
          notional: 0,
          marginRequired: 0,
          maxLeverage,
          problem: `Minimum size is ${minSize} ${info.base}`,
        };
      }

      const notional = markPrice * leg.size;
      const marginRequired = legMargin(info, leg.size, markPrice, maxLeverage);
      return {
        leg,
        markPrice,
        notional,
        marginRequired: marginRequired ?? 0,
        maxLeverage,
        problem: marginRequired === null ? 'Size is out of range' : null,
      };
    });

    const totalNotional = planned.reduce((sum, p) => sum + p.notional, 0);
    // Cross margin, so the legs share one collateral pool: the basket needs the
    // sum of the legs' init margin. Offsetting legs would need less, which only
    // makes this conservative.
    const totalMargin = planned.reduce((sum, p) => sum + p.marginRequired, 0);

    const blockers: string[] = [];
    if (!publicKey) blockers.push('Connect your wallet to send orders');
    planned.forEach((p, i) => {
      if (p.problem) blockers.push(`Order ${i + 1} (${describeLeg(p.leg)}): ${p.problem}`);
    });
    if (feeInsufficient) blockers.push('Not enough fee credit to pay relayer fees — top up first');
    if (publicKey && blockers.length === 0 && totalMargin > freeCollateral) {
      blockers.push(
        `Needs ${usd(totalMargin)} margin, only ${usd(freeCollateral)} free collateral`
      );
    }

    return {
      legs: planned,
      totalNotional,
      totalMargin,
      freeCollateral,
      blockers,
      walletApprovals: oneClick ? 0 : planned.length,
      feeCreditLow: feeStatus.health === 'warn',
      canSubmit: planned.length > 0 && blockers.length === 0,
    };
  }, [
    legs,
    markets,
    serverConfig,
    publicKey,
    freeCollateral,
    feeInsufficient,
    feeStatus.health,
    oneClick,
  ]);
}
