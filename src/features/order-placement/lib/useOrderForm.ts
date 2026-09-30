/**
 * Perps order form state and actions, shared by the /perps trade panel and the
 * /perps-v2 trade ticket: form fields, SL/TP validation, mark price, pre-trade
 * simulation, fee-credit status and order submission.
 */
import { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
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
import { useAccessOwner } from '@/features/access-gate';

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
  const { setVisible } = useWalletModal();
  const { selectedMarket } = useSelectedMarket();
  const { openPosition, openMarketPosition } = usePerps();
  const setSLTPValues = useSetAtom(sltpValuesAtom);
  const setPortfolioActiveTab = useSetAtom(portfolioActiveTabAtom);
  const setFeeCreditOpen = useSetAtom(feeCreditDialogOpenAtom);
  const accountMetrics = useAtomValue(accountMetricsAtom);
  const feeStatus = useFeeStatus();
  const feeHealth = feeStatus.health;
  const feeInsufficient = !!publicKey && feeStatus.isSuccess && !feeStatus.data?.ok;

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

    // Entry reference for SL/TP validation: limit orders use the typed price,
    // market orders have no limit price so they fall back to the live mark price.
    const referencePrice = isMarketOrder ? (markPrice ?? 0) : priceValue;

    // Validate Stop Loss: cannot be above entry price
    if (field === 'stopLoss') {
      const stringValue = value as string;
      if (stringValue !== '') {
        const stopLossValue = safeParseFloat(stringValue);
        if (referencePrice > 0 && stopLossValue > referencePrice) {
          toast.error('Stop Loss cannot be above entry price');
          return; // Reject invalid stop loss
        }
      }
    }

    // Validate Take Profit: cannot be below entry price
    if (field === 'takeProfit') {
      const stringValue = value as string;
      if (stringValue !== '') {
        const takeProfitValue = safeParseFloat(stringValue);
        if (referencePrice > 0 && takeProfitValue < referencePrice) {
          toast.error('Take Profit cannot be below entry price');
          return; // Reject invalid take profit
        }
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

  const handleOpenPosition = async (side: OrderSide) => {
    // Validate SL/TP before submitting. Market orders have no limit price, so
    // they validate against the live mark price as the entry reference.
    if (enableSLTP) {
      const referencePrice = isMarketOrder ? (markPrice ?? 0) : priceValue;
      const stopLossValue = safeParseFloat(formState.stopLoss);
      const takeProfitValue = safeParseFloat(formState.takeProfit);

      if (formState.stopLoss && referencePrice > 0 && stopLossValue > referencePrice) {
        toast.error('Stop Loss cannot be above entry price');
        return;
      }

      if (formState.takeProfit && referencePrice > 0 && takeProfitValue < referencePrice) {
        toast.error('Take Profit cannot be below entry price');
        return;
      }
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
          leverage: '5',
          marginMode: formState.marginMode,
          maxSlippageBps: Math.round(safeParseFloat(formState.slippage, 1) * 100),
          markPrice: markPrice!,
          reduceOnly: formState.reduceOnly,
        });
      } else {
        result = await openPosition({
          side,
          leverage: '5',
          marginMode: formState.marginMode,
          price: formState.price,
          size: formState.size,
          stopLoss: enableSLTP && formState.stopLoss ? formState.stopLoss : undefined,
          takeProfit: enableSLTP && formState.takeProfit ? formState.takeProfit : undefined,
          reduceOnly: formState.reduceOnly,
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
    submittingSide,
    isSubmitting,
    enableSLTP,
    setEnableSLTP,
    customSlippage,
    setCustomSlippage,
    formState,
    setFormState,
    publicKey,
    setVisible,
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
  };
}
