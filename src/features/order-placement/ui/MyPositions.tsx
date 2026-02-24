/**
 * My positions component
 * Displays the user's open positions (perpetuals only)
 */
import { useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { formatQuantity, formatPrice } from '@/features/orderbook-view/lib/processOrderbook';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Button } from '@/shared/ui/button';
import { Loader2 } from 'lucide-react';
import { useSelectedMarket, marketsAtom } from '@/entities/market/model';
import { usePositions } from '@/shared/hooks/usePositions';
import { usePerps } from '@/features/order-placement/lib/usePerps';
import { OrderSide } from '@/features/order-placement/lib/PerpLimitOrderIntent';
import { useAtomValue } from 'jotai';

export function MyPositions() {
  const { publicKey } = useWallet();
  const { selectedMarket } = useSelectedMarket();
  const markets = useAtomValue(marketsAtom);
  const { data: positions, isLoading } = usePositions({ owner: publicKey?.toBase58() || '' });
  const { closePosition } = usePerps();
  const [closingPositionIndex, setClosingPositionIndex] = useState<number | null>(null);

  // Create a map of market_id to market data for quick lookup
  const marketsMap = useMemo(() => {
    return new Map(markets.map(market => [market.uuid, market]));
  }, [markets]);

  const handleClosePosition = async (position: any, index: number) => {
    setClosingPositionIndex(index);

    try {
      // Determine side: if base_position > 0 (long), sell to close; if < 0 (short), buy to close
      const side: OrderSide = parseFloat(position.base_position) > 0 ? 'Sell' : 'Buy';
      const size = Math.abs(parseFloat(position.base_position)).toString();
      const price = position.mark_price;

      const result = await closePosition({
        side,
        price,
        size,
      });

      if (result.success) {
        // Position closed successfully - could refresh positions here if needed
      }
    } catch (error) {
      console.error('Failed to close position:', error);
    } finally {
      setClosingPositionIndex(null);
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
            <TableCell colSpan={8} className="h-24 text-center">
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
          <TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">
            No open positions
          </TableCell>
        </TableRow>
      );
    }

    return positions.map((position, index) => {
      // Convert string values to numbers for formatting
      const basePosition = parseFloat(position.base_position);
      const averageEntryPrice = parseFloat(position.average_entry_price);
      const markPrice = parseFloat(position.mark_price);
      const unrealizedPnl = parseFloat(position.unrealized_pnl);
      const stopLossPrice = position.stop_loss_price ? parseFloat(position.stop_loss_price) : null;
      const takeProfitPrice = position.take_profit_price
        ? parseFloat(position.take_profit_price)
        : null;

      // Get the market data for this position
      const positionMarket = marketsMap.get(position.market_id);

      // Use decimals from the position's market data
      const baseDecimals = positionMarket?.base_decimals ?? 9;
      const quoteDecimals = positionMarket?.quote_decimals ?? 6;

      return (
        <TableRow key={index} className="text-white/90">
          <TableCell className="font-medium">{position.market_name}</TableCell>
          <TableCell className="text-center font-mono tabular-nums">
            {formatQuantity(basePosition, baseDecimals)}
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
            <Button
              variant="outline"
              size="sm"
              disabled={closingPositionIndex === index}
              onClick={() => handleClosePosition(position, index)}
            >
              {closingPositionIndex === index ? (
                <>
                  <Loader2 className="size-3 animate-spin mr-1" />
                  Closing...
                </>
              ) : (
                'Close'
              )}
            </Button>
          </TableCell>
        </TableRow>
      );
    });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
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
