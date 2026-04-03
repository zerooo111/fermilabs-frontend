/**
 * My positions component
 * Displays the user's open positions (perpetuals only)
 */
import { useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { formatQuantity, formatPrice } from '@/features/orderbook-view/lib/processOrderbook';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { NumberInput } from '@/shared/ui/number-input';
import { Loader2 } from 'lucide-react';
import { useSelectedMarket, marketsAtom } from '@/entities/market/model';
import { usePositions } from '@/shared/hooks/usePositions';
import { usePerps } from '@/features/order-placement/lib/usePerps';
import { OrderSide } from '@/features/order-placement/lib/PerpLimitOrderIntent';
import { useAtomValue } from 'jotai';
import { nativeToUiNumber } from '@/shared/lib/harness-market';

type CloseDraft = {
  positionKey: string;
  marketName: string;
  side: OrderSide;
  size: string;
  markPrice: string;
  mode: 'market' | 'limit';
  slippagePercent: string;
  limitPrice: string;
  baseDecimals: number;
  quoteDecimals: number;
  baseUnit: string;
  quoteUnit: string;
};

const safeParseFloat = (value: string, defaultValue: number = 0): number => {
  if (!value || value.trim() === '') return defaultValue;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

export function MyPositions() {
  const { publicKey } = useWallet();
  const { selectedMarket } = useSelectedMarket();
  const markets = useAtomValue(marketsAtom);
  const { data: positions, isLoading } = usePositions({ owner: publicKey?.toBase58() || '' });
  const { closePosition } = usePerps();
  const [closingPositionKey, setClosingPositionKey] = useState<string | null>(null);
  const [closeDraft, setCloseDraft] = useState<CloseDraft | null>(null);

  // Create a map of market_id to market data for quick lookup
  const marketsMap = useMemo(() => {
    return new Map(markets.map(market => [market.uuid, market]));
  }, [markets]);

  const buildPositionKey = (position: any, index: number) =>
    String(position.market_id ?? position.market_name ?? index);

  const buildCloseDraft = (position: any, index: number): CloseDraft => {
    const positionMarket = marketsMap.get(position.market_id);
    const baseDecimals = positionMarket?.base_decimals ?? position.base_decimals ?? 9;
    const quoteDecimals = positionMarket?.quote_decimals ?? position.quote_decimals ?? 6;
    const basePositionUi = nativeToUiNumber(position.base_position, baseDecimals);
    const markPriceUi = nativeToUiNumber(position.mark_price, quoteDecimals);
    const marketName = position.market_name ?? selectedMarket?.name ?? 'Position';
    const baseUnit = positionMarket?.baseTokenName ?? marketName.split('-')[0] ?? 'BASE';
    const quoteUnit = positionMarket?.quoteTokenName ?? 'USDC';

    return {
      positionKey: buildPositionKey(position, index),
      marketName,
      side: basePositionUi > 0 ? 'Sell' : 'Buy',
      size: Math.abs(basePositionUi).toString(),
      markPrice: markPriceUi.toString(),
      mode: 'market',
      slippagePercent: '0.5',
      limitPrice: markPriceUi.toString(),
      baseDecimals,
      quoteDecimals,
      baseUnit,
      quoteUnit,
    };
  };

  const handleClosePopoverOpenChange = (position: any, index: number, open: boolean) => {
    const positionKey = buildPositionKey(position, index);
    if (open) {
      setCloseDraft(buildCloseDraft(position, index));
      return;
    }
    setCloseDraft(current => (current?.positionKey === positionKey ? null : current));
  };

  const handleSubmitClose = async () => {
    if (!closeDraft) return;

    setClosingPositionKey(closeDraft.positionKey);
    try {
      const result = await closePosition({
        side: closeDraft.side,
        size: closeDraft.size,
        mode: closeDraft.mode,
        markPrice: safeParseFloat(closeDraft.markPrice),
        maxSlippageBps: Math.round(Math.max(0, safeParseFloat(closeDraft.slippagePercent, 0.5) * 100)),
        limitPrice: closeDraft.limitPrice,
      });

      if (result.success) {
        setCloseDraft(null);
      }
    } catch (error) {
      console.error('Failed to close position:', error);
    } finally {
      setClosingPositionKey(null);
    }
  };

  if (!publicKey) {
    return (
      <div>
        <h2 className="text-lg font-medium">Please connect your wallet</h2>
      </div>
    );
  }

  if (selectedMarket?.kind !== 'perp') {
    return (
      <div>
        <h2 className="text-lg font-medium">Positions are only available for perpetual markets</h2>
      </div>
    );
  }

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
            <TableRow>
              <TableHead className="text-center">Side</TableHead>
              <TableHead>Market</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead className="text-right">Entry Price</TableHead>
              <TableHead className="text-right">Current Price</TableHead>
              <TableHead className="text-right">PnL</TableHead>
            <TableHead className="text-right">Stop Loss</TableHead>
            <TableHead className="text-right">Take Profit</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={9} className="h-24 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading positions...
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  const renderTableContent = () => {
    if (!positions || positions.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
            No open positions
          </TableCell>
        </TableRow>
      );
    }

      return positions.map((position, index) => {
        // Convert string values to numbers for formatting
        const basePosition = parseFloat(position.base_position);
        const sideLabel = basePosition >= 0 ? 'Long' : 'Short';
        const averageEntryPrice = parseFloat(position.average_entry_price);
        const markPrice = parseFloat(position.mark_price);
        const unrealizedPnl = parseFloat(position.unrealized_pnl);
      const stopLossPrice = position.stop_loss_price ? parseFloat(position.stop_loss_price) : null;
      const takeProfitPrice = position.take_profit_price
        ? parseFloat(position.take_profit_price)
        : null;

      // Get the market data for this position
      const positionMarket = marketsMap.get(position.market_id);
      const positionKey = buildPositionKey(position, index);
      const isClosePopoverOpen = closeDraft?.positionKey === positionKey;
      const isClosing = closingPositionKey === positionKey;
      const activeCloseDraft = isClosePopoverOpen ? closeDraft : null;

      // Use decimals from the position's market data
      const baseDecimals = positionMarket?.base_decimals ?? 9;
      const quoteDecimals = positionMarket?.quote_decimals ?? 6;
      const closeSlippagePercent = Math.max(
        0,
        safeParseFloat(activeCloseDraft?.slippagePercent ?? '', 0.5)
      );
      const closePreviewPrice = activeCloseDraft
        ? activeCloseDraft.mode === 'market'
          ? safeParseFloat(activeCloseDraft.markPrice) *
            (activeCloseDraft.side === 'Buy'
              ? 1 + closeSlippagePercent / 100
              : 1 - closeSlippagePercent / 100)
          : safeParseFloat(activeCloseDraft.limitPrice)
        : 0;
      const closeSubmitDisabled =
        !activeCloseDraft || !Number.isFinite(closePreviewPrice) || closePreviewPrice <= 0 || isClosing;

        return (
          <TableRow key={positionKey} className="text-white/90">
            <TableCell className="text-center">
              <Badge variant={basePosition >= 0 ? 'success' : 'danger'}>{sideLabel}</Badge>
            </TableCell>
            <TableCell className="font-medium">{position.market_name}</TableCell>
            <TableCell className="text-center font-mono tabular-nums">
              {formatQuantity(Math.abs(basePosition), baseDecimals)}
            </TableCell>
            <TableCell className="text-center font-mono tabular-nums">
              {formatPrice(averageEntryPrice, quoteDecimals)}
          </TableCell>
          <TableCell className="text-center font-mono tabular-nums">
            {formatPrice(markPrice, quoteDecimals)}
          </TableCell>
          <TableCell
            className={`text-center font-mono tabular-nums ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}
          >
            {formatPrice(unrealizedPnl, quoteDecimals)}
          </TableCell>
          <TableCell className="text-center font-mono tabular-nums">
            {stopLossPrice !== null ? formatPrice(stopLossPrice, quoteDecimals) : '-'}
          </TableCell>
          <TableCell className="text-center font-mono tabular-nums">
            {takeProfitPrice !== null ? formatPrice(takeProfitPrice, quoteDecimals) : '-'}
          </TableCell>
          <TableCell className="text-center">
            <Popover
              open={isClosePopoverOpen}
              onOpenChange={open => handleClosePopoverOpenChange(position, index, open)}
            >
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" disabled={Boolean(closingPositionKey && !isClosing)}>
                  {isClosing ? (
                    <>
                      <Loader2 className="size-3 animate-spin mr-1" />
                      Closing...
                    </>
                  ) : (
                    'Close'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-3">
                {activeCloseDraft && (
                  <>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Close {activeCloseDraft.marketName}</div>
                      <div className="text-xs text-zinc-400">
                        {activeCloseDraft.side === 'Buy' ? 'Buy to close short' : 'Sell to close long'}
                      </div>
                    </div>

                    <Tabs
                      value={activeCloseDraft.mode}
                      onValueChange={value =>
                        setCloseDraft(current =>
                          current
                            ? {
                                ...current,
                                mode: value === 'limit' ? 'limit' : 'market',
                              }
                            : current
                        )
                      }
                    >
                      <TabsList className="w-full border-b border-outline">
                        <TabsTrigger value="market" className="flex-1">
                          Market
                        </TabsTrigger>
                        <TabsTrigger value="limit" className="flex-1">
                          Limit
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    {activeCloseDraft.mode === 'market' ? (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-zinc-300">Max Slippage</div>
                        <div className="flex gap-1.5">
                          {[25, 50, 100, 200].map(bps => (
                            <Button
                              key={bps}
                              type="button"
                              variant="outline"
                              size="sm"
                              className={`h-8 flex-1 text-xs ${
                                activeCloseDraft.slippagePercent === (bps / 100).toString()
                                  ? 'bg-white text-black font-bold hover:bg-white/90'
                                  : 'hover:bg-accent/50'
                              }`}
                              onClick={() =>
                                setCloseDraft(current =>
                                  current
                                    ? { ...current, slippagePercent: (bps / 100).toString() }
                                    : current
                                )
                              }
                            >
                              {`${(bps / 100)
                                .toFixed(bps % 100 === 0 ? 0 : 2)
                                .replace(/(\.\d*[1-9])0+$|\.0+$/, '$1')}%`}
                            </Button>
                          ))}
                        </div>
                        <NumberInput
                          name={`close-slippage-${positionKey}`}
                          label="Custom Slippage"
                          value={activeCloseDraft.slippagePercent}
                          onValueChange={values =>
                            setCloseDraft(current =>
                              current ? { ...current, slippagePercent: values.value || '' } : current
                            )
                          }
                          min={0}
                          max={100}
                          decimalScale={2}
                          allowNegative={false}
                          unit="%"
                        />
                        <div className="text-xs text-zinc-400">
                          Submits a reduce-only IOC close with a price cap of{' '}
                          <span className="font-mono tabular-nums text-zinc-100">
                            {formatPrice(closePreviewPrice, activeCloseDraft.quoteDecimals)}
                          </span>{' '}
                          {activeCloseDraft.quoteUnit}.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <NumberInput
                          name={`close-limit-${positionKey}`}
                          label="Limit Price"
                          value={activeCloseDraft.limitPrice}
                          onValueChange={values =>
                            setCloseDraft(current =>
                              current ? { ...current, limitPrice: values.value || '' } : current
                            )
                          }
                          min={0}
                          decimalScale={activeCloseDraft.quoteDecimals}
                          allowNegative={false}
                          unit={activeCloseDraft.quoteUnit}
                        />
                        <div className="text-xs text-zinc-400">
                          Submits a resting reduce-only limit close that can remain on the book.
                        </div>
                      </div>
                    )}

                    <div className="rounded-md border border-outline bg-background/40 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-zinc-400">Size</span>
                        <span className="font-mono tabular-nums">
                          {formatQuantity(
                            Math.abs(safeParseFloat(activeCloseDraft.size)),
                            activeCloseDraft.baseDecimals
                          )}{' '}
                          {activeCloseDraft.baseUnit}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <span className="text-zinc-400">Mark</span>
                        <span className="font-mono tabular-nums">
                          {formatPrice(
                            safeParseFloat(activeCloseDraft.markPrice),
                            activeCloseDraft.quoteDecimals
                          )}{' '}
                          {activeCloseDraft.quoteUnit}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <span className="text-zinc-400">
                          {activeCloseDraft.mode === 'market' ? 'IOC Cap' : 'Limit'}
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatPrice(closePreviewPrice, activeCloseDraft.quoteDecimals)}{' '}
                          {activeCloseDraft.quoteUnit}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isClosing}
                        onClick={() => setCloseDraft(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={closeSubmitDisabled}
                        onClick={handleSubmitClose}
                      >
                        {isClosing ? (
                          <>
                            <Loader2 className="size-3 animate-spin mr-1" />
                            Submitting...
                          </>
                        ) : activeCloseDraft.mode === 'market' ? (
                          'Submit Market Close'
                        ) : (
                          'Submit Limit Close'
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </PopoverContent>
            </Popover>
          </TableCell>
        </TableRow>
      );
    });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-center">Side</TableHead>
          <TableHead>Market</TableHead>
          <TableHead className="text-center">Size</TableHead>
          <TableHead className="text-center">Entry Price</TableHead>
          <TableHead className="text-center">Current Price</TableHead>
          <TableHead className="text-center">PnL</TableHead>
          <TableHead className="text-center">Stop Loss</TableHead>
          <TableHead className="text-center">Take Profit</TableHead>
          <TableHead className="text-center">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{renderTableContent()}</TableBody>
    </Table>
  );
}
