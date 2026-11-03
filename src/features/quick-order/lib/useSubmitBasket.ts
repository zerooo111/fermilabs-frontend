/**
 * Sends a quick-order basket.
 *
 * Best effort and sequential, because the protocol has no multi-market atomic
 * submit: every leg is its own signed intent on its own market's execution
 * queue (usePerps `submitIntent`). So the legs go out one at a time, the first
 * failure stops the rest, and the report always says how many actually went —
 * a partial basket is never reported as success.
 */
import { useCallback, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtom, useSetAtom } from 'jotai';
import posthog from 'posthog-js';
import { toast } from 'sonner';
import { portfolioActiveTabAtom } from '@/entities/market';
import { useOneClick } from '@/features/one-click';
import { usePerps } from '@/features/order-placement/lib/usePerps';
import { QueuePlaceOrderType } from '@/shared/lib/mango-execution-queue';
import { describeLeg } from '../model/parse';
import { quickOrderRecentBasesAtom } from '../model/atoms';
import type { BasketPlan } from '../model/useBasketPlan';

export interface BasketOutcome {
  sent: number;
  total: number;
  /** Why the run stopped, when it did not finish. */
  error?: string;
}

/** "Long 2 SOL + 2 more" — the basket in one line. */
export function describeBasket(plan: BasketPlan): string {
  const [first, ...rest] = plan.legs;
  if (!first) return 'No orders';
  return rest.length > 0
    ? `${describeLeg(first.leg)} + ${rest.length} more`
    : describeLeg(first.leg);
}

const RECENT_BASES_KEPT = 6;

export function useSubmitBasket() {
  const { publicKey } = useWallet();
  const { placeTakerOrder } = usePerps();
  const { intentSigner } = useOneClick();
  const setPortfolioTab = useSetAtom(portfolioActiveTabAtom);
  const [recentBases, setRecentBases] = useAtom(quickOrderRecentBasesAtom);
  /** How many legs are done, while a basket is in flight. */
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);

  const submit = useCallback(
    async (plan: BasketPlan, maxSlippageBps: number): Promise<BasketOutcome> => {
      const total = plan.legs.length;
      const summary = describeBasket(plan);
      const toastId = toast.loading(`${summary} — Sending…`);
      const showPositions = { label: 'Positions', onClick: () => setPortfolioTab('positions') };

      setProgress({ sent: 0, total });
      let sent = 0;
      let failure: string | undefined;

      for (const [index, planned] of plan.legs.entries()) {
        try {
          await placeTakerOrder({
            marketId: planned.leg.market.id,
            side: planned.leg.side,
            size: planned.leg.size,
            markPrice: planned.markPrice!,
            maxSlippageBps,
            // IOC, not Market: it is the only taker type whose price limit the
            // program honours, so "max slippage" means something.
            orderType: QueuePlaceOrderType.ImmediateOrCancel,
          });
          sent += 1;
          setProgress({ sent, total });
          if (sent < total) {
            toast.loading(`${summary} — ${sent} of ${total} sent…`, { id: toastId });
          }
        } catch (error) {
          failure = error instanceof Error ? error.message : 'Unknown error';
          toast.error(
            sent === 0
              ? `Nothing sent — order ${index + 1} failed: ${failure}`
              : `${sent} of ${total} sent, order ${index + 1} failed: ${failure}`,
            { id: toastId, duration: 15_000, action: sent > 0 ? showPositions : undefined }
          );
          break;
        }
      }

      setProgress(null);

      if (!failure) {
        toast.success(total === 1 ? 'Order sent' : `${total} orders sent`, {
          id: toastId,
          description: 'Market fills land in Positions; unfilled size is cancelled.',
          duration: 12_000,
          action: showPositions,
        });
        const bases = plan.legs.map(p => p.leg.market.base);
        setRecentBases([...new Set([...bases, ...recentBases])].slice(0, RECENT_BASES_KEPT));
      }

      posthog.capture('quick_order_basket_submitted', {
        legs: total,
        sent,
        outcome: !failure ? 'sent' : sent > 0 ? 'partial' : 'failed',
        max_slippage_bps: maxSlippageBps,
        one_click: !!intentSigner,
        markets: plan.legs.map(p => p.leg.market.symbol),
        notional: plan.totalNotional,
        error_message: failure,
        wallet: publicKey?.toBase58(),
      });

      return { sent, total, error: failure };
    },
    [intentSigner, placeTakerOrder, publicKey, recentBases, setPortfolioTab, setRecentBases]
  );

  return { submit, progress };
}
