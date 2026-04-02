/**
 * My trades component
 * Displays the user's trades history
 */
import { useWallet } from '@solana/wallet-adapter-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Badge } from '@/shared/ui/badge';
import { selectedMarketAtom } from '@/entities/market/model';
import { useAtomValue } from 'jotai';
import {
  formatPrice,
  formatQuantity,
  formatTotal,
} from '@/features/orderbook-view/lib/processOrderbook';
import { userTradesAtom } from '@/shared/api/sse-atoms';

export function MyTrades() {
  const { publicKey } = useWallet();
  const selectedMarket = useAtomValue(selectedMarketAtom);
  const trades = useAtomValue(userTradesAtom);

  if (!publicKey) {
    return (
      <div>
        <h2 className="text-lg font-medium">Please connect your wallet</h2>
      </div>
    );
  }

  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const renderTableContent = () => {
    if (trades.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
            No trades found
          </TableCell>
        </TableRow>
      );
    }

    return trades.map(trade => {
      const isBuyer = trade.buyer_owner === publicKey?.toBase58();
      const side = isBuyer ? 'Buy' : 'Sell';

      return (
        <TableRow key={trade.id}>
          <TableCell>{new Date(trade.timestamp * 1000).toLocaleString()}</TableCell>
          <TableCell>
            <Badge variant={side === 'Buy' ? 'success' : 'danger'}>{side}</Badge>
          </TableCell>
          <TableCell className="font-mono">
            {formatPrice(trade.price, selectedMarket?.quoteDecimals ?? 6)}{' '}
            {selectedMarket?.quoteTokenName}
          </TableCell>
          <TableCell className="font-mono">
            {formatQuantity(trade.quantity, selectedMarket?.baseDecimals ?? 9)}{' '}
            {selectedMarket?.baseTokenName}
          </TableCell>
          <TableCell className="font-mono">
            <span className={isBuyer ? 'text-success' : ''}>
              {truncateAddress(trade.buyer_owner)}
            </span>
          </TableCell>
          <TableCell className="font-mono">
            <span className={!isBuyer ? 'text-danger' : ''}>
              {truncateAddress(trade.seller_owner)}
            </span>
          </TableCell>
          <TableCell className="text-right font-mono">
            {formatTotal(
              trade.price,
              trade.quantity,
              selectedMarket?.quoteDecimals ?? 6,
              selectedMarket?.baseDecimals ?? 9
            )}{' '}
            {selectedMarket?.quoteTokenName}
          </TableCell>
        </TableRow>
      );
    });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Side</TableHead>
          <TableHead>Price ({selectedMarket?.quoteTokenName})</TableHead>
          <TableHead>Size ({selectedMarket?.baseTokenName})</TableHead>
          <TableHead>Buyer</TableHead>
          <TableHead>Seller</TableHead>
          <TableHead className="text-right">Total ({selectedMarket?.quoteTokenName})</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{renderTableContent()}</TableBody>
    </Table>
  );
}
