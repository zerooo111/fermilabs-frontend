/**
 * My positions component
 * Displays the user's open positions (perpetuals only)
 */
import { useWallet } from '@solana/wallet-adapter-react';
import { formatQuantity, formatPrice } from '@/features/orderbook-view/lib/processOrderbook';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Button } from '@/shared/ui/button';
import { Loader2 } from 'lucide-react';
import { useSelectedMarket } from '@/entities/market/model';
import { usePositions } from '@/shared/hooks/usePositions';

export function MyPositions() {
  const { publicKey } = useWallet();
  const { selectedMarket } = useSelectedMarket();
  const { data: positions, isLoading } = usePositions(publicKey?.toBase58() || '');

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
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={6} className="h-24 text-center">
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
    if (positions.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
            No open positions
          </TableCell>
        </TableRow>
      );
    }

    return positions.map((position, index) => (
      <TableRow key={index} className="text-white/90">
        <TableCell className="font-medium">{position.market_name}</TableCell>
        <TableCell className="text-center font-mono tabular-nums">
          {formatQuantity(position.base_position, selectedMarket.baseDecimals)}
        </TableCell>
        <TableCell className="text-center font-mono tabular-nums">
          {formatPrice(position.average_entry_price, selectedMarket.quoteDecimals)}
        </TableCell>
        <TableCell className="text-center font-mono tabular-nums">
          {formatPrice(position.mark_price, selectedMarket.quoteDecimals)}
        </TableCell>
        <TableCell
          className={`text-center font-mono tabular-nums ${parseFloat(position.unrealized_pnl) >= 0 ? 'text-green-400' : 'text-red-400'}`}
        >
          {formatPrice(parseFloat(position.unrealized_pnl), selectedMarket.quoteDecimals)}
        </TableCell>
        <TableCell className="text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              alert('Work in progress.');
            }}
          >
            Close
          </Button>
        </TableCell>
      </TableRow>
    ));
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
          <TableHead className="text-center">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{renderTableContent()}</TableBody>
    </Table>
  );
}
