/**
 * Perps order form state and actions for the /perps trade ticket: form fields,
 * SL/TP validation, mark price, pre-trade simulation, fee-credit status and
 * order submission.
 */
import { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue, useSetAtom } from 'jotai';
import { toast } from 'sonner';

import { MarginMode, OrderSide } from '@/features/order-placement/lib/PerpLimitOrderIntent';
import { getTokenDecimals } from '@/shared/lib/token-decimals';
import { useSelectedMarket, sltpValuesAtom, portfolioActiveTabAtom } from '@/entities/market';
import { useFeeStatus, feeCreditDialogOpenAtom } from '@/features/fee-credit';
import { usePerps } from '@/features/order-placement/lib/usePerps';
import { useSimulate } from '@/features/order-placement/lib/useSimulate';
import { warmSimulate } from '@/features/order-placement/lib/simulateApi';
import { useMarketStats } from '@/shared/hooks/useMarketStats';
import { accountMetricsAtom } from '@/shared/api/sse-atoms';
import { gateOpenAtom, useAccessOwner } from '@/features/access-gate';
import { serverConfigAtom, type ServerConfigMarket } from '@/entities/server';
import { useTriggerOrdersEnabled } from '@/features/trigger-orders/model/useTriggerOrders';
import { TRIGGER_EXPIRY_SECS, TRIGGER_SLIPPAGE_BPS } from '@/features/trigger-orders/lib/display';

// Used when /config has no risk weights for the market
export const DEFAULT_MAX_LEVERAGE = 5;

// Safe parsing functions to prevent NaN errors
export const safeParseFloat = (value: string, defaultValue: number = 0): number => {
  if (!value || value.trim() === '') return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const marketQuoteDecimals = (selectedMarket: any): number =>
  Math.max(
    0,
    selectedMarket?.quoteDecimals ??
      selectedMarket?.quote_decimals ??
      getTokenDecimals(selectedMarket?.quoteTokenName)
  );

export const marketBaseDecimals = (selectedMarket: any): number =>
  Math.max(
    0,
    selectedMarket?.baseDecimals ??
      selectedMarket?.base_decimals ??
      getTokenDecimals(selectedMarket?.baseTokenName)
  );

/**
 * Max leverage and maintenance weights for a market, from the on-chain init
 * weights /config reports. A long needs (1 - initAssetWeight) of its notional
 * as margin and a short (initLiabWeight - 1), so max leverage is the inverse;
 * take the lower of the two so one limit covers both sides.
 */
export function marketRiskLimits(risk: ServerConfigMarket['risk'] | undefined) {
  const initAsset = Number(risk?.init_base_asset_weight);
  const initLiab = Number(risk?.init_base_liab_weight);
  const longMax = initAsset < 1 ? 1 / (1 - initAsset) : NaN;
  const shortMax = initLiab > 1 ? 1 / (initLiab - 1) : NaN;
  const max = Math.floor(Math.min(longMax, shortMax) + 1e-6);
  const maintAsset = Number(risk?.maint_base_asset_weight);
  const maintLiab = Number(risk?.maint_base_liab_weight);
  return {
    maxLeverage: Number.isFinite(max) && max >= 1 ? max : DEFAULT_MAX_LEVERAGE,
    maintAssetWeight: maintAsset > 0 ? maintAsset : 1,
    maintLiabWeight: maintLiab > 0 ? maintLiab : 1,
  };
}

export function useOrderForm() {
  const [submittingSide, setSubmittingSide] = useState<OrderSide | null>(null);
  const isSubmitting = submittingSide !== null;
  const [enableSLTP, setEnableSLTP] = useState(false);
  const [customSlippage, setCustomSlippage] = useState(false);
  const [formState, setFormState] = useState<{
    price: string;
    size: string;
    orderType: string;
    marginMode: MarginMode;
    stopLoss: string;
    takeProfit: string;
    slippage: string;
    reduceOnly: boolean;
  }>({
    price: '',
    size: '',
    orderType: 'market',
    marginMode: 'cross',
    stopLoss: '',
    takeProfit: '',
    slippage: '0.25',
    reduceOnly: false,
  });

  const { publicKey } = useWallet();
  const accessOwner = useAccessOwner();
  const setGateOpen = useSetAtom(gateOpenAtom);
  const { selectedMarket } = useSelectedMarket();
  const { openPosition, openMarketPosition, placeTriggerLegs } = usePerps();
  const sltpAvailable = useTriggerOrdersEnabled();
  const setSLTPValues = useSetAtom(sltpValuesAtom);
  const setPortfolioActiveTab = useSetAtom(portfolioActiveTabAtom);
  const setFeeCreditOpen = useSetAtom(feeCreditDialogOpenAtom);
  const accountMetrics = useAtomValue(accountMetricsAtom);
  const feeStatus = useFeeStatus();
  const feeHealth = feeStatus.health;
  const feeInsufficient = !!publicKey && feeStatus.isSuccess && !feeStatus.data?.ok;
  const serverConfig = useAtomValue(serverConfigAtom);

  const marketIndexForRisk = selectedMarket ? parseInt(selectedMarket.uuid, 10) : null;
  const riskLimits = useMemo(
    () =>
      marketRiskLimits(
        serverConfig?.markets.find(m => m.market_index === marketIndexForRisk)?.risk
      ),
    [serverConfig, marketIndexForRisk]
  );
  // The backend always sizes margin at the market max, so there is no leverage
  // to choose: effective leverage is just position size over margin
  const { maxLeverage } = riskLimits;

  // Warm the simulation cache as soon as the wallet connects, before the user fills the form
  useEffect(() => {
    if (!accessOwner) return;
    warmSimulate(accessOwner).catch(() => {});
  }, [accessOwner]);

  // Fetch market stats to get mark price
  const { data: marketsData } = useMarketStats({
    refetchInterval: 1000,
    enabled: !!selectedMarket,
  });

  // Get mark price for the selected market
  const markPrice = useMemo(() => {
    if (!selectedMarket?.uuid || !marketsData) return null;

    const currentMarketData = marketsData.find(m => m.uuid === selectedMarket.uuid);
    if (!currentMarketData || currentMarketData.kind !== 'perp' || !currentMarketData.perp_state) {
      return null;
    }

    const rawMarkPrice = currentMarketData.perp_state.mark_price;
    if (rawMarkPrice === null || rawMarkPrice === undefined || rawMarkPrice <= 0) {
      return null;
    }

    // Normalize mark_price by dividing by 10^quoteDecimals
    const quoteDecimals = marketQuoteDecimals(selectedMarket);
    return rawMarkPrice / Math.pow(10, quoteDecimals);
  }, [selectedMarket?.uuid, selectedMarket?.quoteDecimals, marketsData]);

  // Calculate order value considering decimal inputs with safe parsing
  const priceValue = safeParseFloat(formState.price);
  const sizeValue = safeParseFloat(formState.size);
  const orderValue = priceValue * sizeValue;
  const isMarketOrder = formState.orderType === 'market';

  const marketIndex = selectedMarket ? parseInt(selectedMarket.uuid, 10) : null;
  const simulateEnabled = !!accessOwner && !!selectedMarket && sizeValue > 0;

  const buySimulate = useSimulate({
    owner: accessOwner,
    marketIndex,
    side: 'buy',
    quantity: sizeValue,
    price: isMarketOrder ? null : priceValue > 0 ? priceValue : null,
    orderType: isMarketOrder ? 'market' : 'limit',
    enabled: simulateEnabled,
  });

  const sellSimulate = useSimulate({
    owner: accessOwner,
    marketIndex,
    side: 'sell',
    quantity: sizeValue,
    price: isMarketOrder ? null : priceValue > 0 ? priceValue : null,
    orderType: isMarketOrder ? 'market' : 'limit',
    enabled: simulateEnabled,
  });

  const buyWouldReject = buySimulate.data?.would_reject ?? false;
  const sellWouldReject = sellSimulate.data?.would_reject ?? false;
  const simLoading =
    (buySimulate.isFetching || sellSimulate.isFetching) && !buySimulate.data && !sellSimulate.data;

  // Computed leverage: position size in USD / free collateral
  // Free collateral is used as the proxy for margin available (max 5x enforced server-side).
  const computedLeverage = useMemo(() => {
    const freeCollateral = accountMetrics?.free_collateral_snapshot ?? 0;
    const effectivePrice = isMarketOrder ? (markPrice ?? 0) : priceValue;
    const positionSizeUsd = effectivePrice * sizeValue;
    if (freeCollateral <= 0 || positionSizeUsd <= 0) return null;
    return positionSizeUsd / freeCollateral;
  }, [accountMetrics, isMarketOrder, markPrice, priceValue, sizeValue]);

  const handleInputChange = (field: string, value: string | boolean) => {
    // Validate numeric inputs for price, size, stopLoss, and takeProfit
    if (field === 'price' || field === 'size' || field === 'stopLoss' || field === 'takeProfit') {
      const stringValue = value as string;
      // Allow empty string, numbers, and decimal point
      if (stringValue !== '' && !/^\d*\.?\d*$/.test(stringValue)) {
        return; // Reject invalid characters
      }
    }

    setFormState(prev => {
      const newState = { ...prev, [field]: value };

      // Update SL/TP atom when values change
      if (field === 'stopLoss' || field === 'takeProfit') {
        const stopLossValue = field === 'stopLoss' ? (value as string) : newState.stopLoss;
        const takeProfitValue = field === 'takeProfit' ? (value as string) : newState.takeProfit;

        const sltp = {
          stopLoss: stopLossValue ? safeParseFloat(stopLossValue) : null,
          takeProfit: takeProfitValue ? safeParseFloat(takeProfitValue) : null,
        };

        setSLTPValues(sltp);
      }

      return newState;
    });
  };

  // SL/TP prices against the entry: below/above it for a long, the reverse
  // for a short. Returns the problem and the field it is on (null when
  // neither price is set), or null.
  const sltpError = (
    side: OrderSide,
    entryPrice: number | null
  ): { field: 'stopLoss' | 'takeProfit' | null; message: string } | null => {
    if (!sltpAvailable || !enableSLTP || formState.reduceOnly) return null;
    const stopLoss = safeParseFloat(formState.stopLoss);
    const takeProfit = safeParseFloat(formState.takeProfit);
    if (!stopLoss && !takeProfit) {
      return { field: null, message: 'Set a stop loss or take profit price' };
    }
    if (!entryPrice || entryPrice <= 0) return null;
    const long = side === 'Buy';
    const order = long ? 'buy' : 'sell';
    if (stopLoss && (long ? stopLoss >= entryPrice : stopLoss <= entryPrice)) {
      return {
        field: 'stopLoss',
        message: `Stop loss must be ${long ? 'below' : 'above'} the entry price for a ${order}`,
      };
    }
    if (takeProfit && (long ? takeProfit <= entryPrice : takeProfit >= entryPrice)) {
      return {
        field: 'takeProfit',
        message: `Take profit must be ${long ? 'above' : 'below'} the entry price for a ${order}`,
      };
    }
    return null;
  };

  const handleOpenPosition = async (side: OrderSide) => {
    // SL/TP are trigger legs (reduce-only IOCs held by the trigger-orders
    // keeper). They wait as "pending" until the entry fills, so they go out
    // right after it, for market and limit entries alike.
    const withSLTP = sltpAvailable && enableSLTP && !formState.reduceOnly;
    const sltpProblem = sltpError(side, isMarketOrder ? markPrice : priceValue);
    if (sltpProblem) {
      toast.error(sltpProblem.message);
      return;
    }

    if (isMarketOrder && (!markPrice || markPrice <= 0)) {
      toast.error('Mark price unavailable — cannot place market order');
      return;
    }

    setSubmittingSide(side);

    try {
      let result: { success: boolean; error?: string };

      if (isMarketOrder) {
        result = await openMarketPosition({
          side,
          size: formState.size,
          leverage: String(maxLeverage),
          marginMode: formState.marginMode,
          maxSlippageBps: Math.round(safeParseFloat(formState.slippage, 1) * 100),
          markPrice: markPrice!,
          reduceOnly: formState.reduceOnly,
        });
      } else {
        result = await openPosition({
          side,
          leverage: String(maxLeverage),
          marginMode: formState.marginMode,
          price: formState.price,
          size: formState.size,
          reduceOnly: formState.reduceOnly,
        });
      }

      // Sized to this entry, so the bracket protects exactly what it opened.
      if (result.success && withSLTP && selectedMarket) {
        await placeTriggerLegs({
          marketIndex: parseInt(selectedMarket.uuid, 10),
          position: side === 'Buy' ? 'long' : 'short',
          size: formState.size,
          stopLoss: formState.stopLoss || undefined,
          takeProfit: formState.takeProfit || undefined,
          slippageBps: TRIGGER_SLIPPAGE_BPS,
          expiresInSecs: TRIGGER_EXPIRY_SECS,
        });
      }

      if (result.success) {
        setFormState(prev => ({
          ...prev,
          price: '',
          size: '',
          stopLoss: '',
          takeProfit: '',
        }));
        setSLTPValues({ stopLoss: null, takeProfit: null });
        setPortfolioActiveTab(isMarketOrder ? 'positions' : 'orders');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to place order');
    } finally {
      setSubmittingSide(null);
    }
  };

  return {
    maxLeverage,
    maintAssetWeight: riskLimits.maintAssetWeight,
    maintLiabWeight: riskLimits.maintLiabWeight,
    submittingSide,
    isSubmitting,
    enableSLTP,
    setEnableSLTP,
    customSlippage,
    setCustomSlippage,
    formState,
    setFormState,
    publicKey,
    openConnect: () => setGateOpen(true),
    selectedMarket,
    setSLTPValues,
    setFeeCreditOpen,
    accountMetrics,
    feeStatus,
    feeHealth,
    feeInsufficient,
    markPrice,
    priceValue,
    sizeValue,
    orderValue,
    isMarketOrder,
    buySimulate,
    sellSimulate,
    buyWouldReject,
    sellWouldReject,
    simLoading,
    computedLeverage,
    handleInputChange,
    handleOpenPosition,
    sltpError,
  };
}
