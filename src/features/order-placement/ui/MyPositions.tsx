/**
 * My positions component
 * Displays the user's open positions (perpetuals only)
 */
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue } from 'jotai';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Button } from '@/shared/ui/button';
import { Loader2 } from 'lucide-react';
import { selectedMarketAtom } from '@/entities/market/model';
import { usePositions } from '@/shared/hooks/usePositions';
import { useEffect } from 'react';

export function MyPositions() {
  const { publicKey } = useWallet();
  const selectedMarket = useAtomValue(selectedMarketAtom);

  const { data: positions, isLoading } = usePositions(publicKey?.toBase58() || '');

  useEffect(() => {
    console.log('positions', positions);
  }, [positions]);
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
          {position.base_position}
        </TableCell>
        <TableCell className="text-center font-mono tabular-nums">
          {position.average_entry_price}
        </TableCell>
        <TableCell className="text-center font-mono tabular-nums">{position.mark_price}</TableCell>
        <TableCell
          className={`text-center font-mono tabular-nums ${parseFloat(position.unrealized_pnl) >= 0 ? 'text-green-400' : 'text-red-400'}`}
        >
          {position.unrealized_pnl}
        </TableCell>
        <TableCell className="text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // TODO: Implement close position logic
              console.log('Close position:', position.market_id);
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
