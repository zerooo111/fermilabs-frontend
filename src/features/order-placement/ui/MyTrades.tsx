/**
 * My trades component
 * Displays the user's trades history
 */
import { useWallet } from '@solana/wallet-adapter-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Badge } from '@/shared/ui/badge';
import { useSequencerApi } from '@/shared/api/useSequencerApi';
import { selectedMarketAtom } from '@/entities/market/model';
import { useAtomValue } from 'jotai';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export function MyTrades() {
  const { publicKey } = useWallet();
  const { fetchTrades } = useSequencerApi();
  const selectedMarket = useAtomValue(selectedMarketAtom);

  const { data: trades = [], isLoading } = useQuery({
    queryKey: ['trades', publicKey?.toBase58(), selectedMarket?.uuid],
    queryFn: async () => {
      if (!publicKey || !selectedMarket) return [];
      return fetchTrades(publicKey.toBase58(), selectedMarket.uuid);
    },
    enabled: !!publicKey && !!selectedMarket,
    refetchInterval: 1000, // Refetch every 1 second
    staleTime: 5000, // Consider data stale after 5 seconds
  });

  if (!publicKey) {
    return (
      <div>
        <h2 className="text-lg font-medium">Please connect your wallet</h2>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="border w-full glass-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="bg-primary text-neutral-100">Time</TableHead>
              <TableHead className="bg-primary text-neutral-100">Side</TableHead>
              <TableHead className="bg-primary text-neutral-100">Price</TableHead>
              <TableHead className="bg-primary text-neutral-100">Size</TableHead>
              <TableHead className="bg-primary text-neutral-100">Buyer</TableHead>
              <TableHead className="bg-primary text-neutral-100">Seller</TableHead>
              <TableHead className="bg-primary text-neutral-100 text-right">
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading trades...
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
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
        <TableRow key={trade.id} className="text-xs">
          <TableCell>{new Date(trade.timestamp * 1000).toLocaleString()}</TableCell>
          <TableCell>
            <Badge variant={side === 'Buy' ? 'success' : 'danger'}>{side}</Badge>
          </TableCell>
          <TableCell className="font-mono">
            {trade.price} {selectedMarket?.quoteTokenName}
          </TableCell>
          <TableCell className="font-mono">
            {trade.quantity} {selectedMarket?.baseTokenName}
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
            {trade.price * trade.quantity} {selectedMarket?.quoteTokenName}
          </TableCell>
        </TableRow>
      );
    });
  };

  return (
    <div className="overflow-hidden border w-full mt-2 glass-panel">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="bg-primary text-neutral-100">Time</TableHead>
            <TableHead className="bg-primary text-neutral-100">Side</TableHead>
            <TableHead className="bg-primary text-neutral-100">
              Price ({selectedMarket?.quoteTokenName})
            </TableHead>
            <TableHead className="bg-primary text-neutral-100">
              Size ({selectedMarket?.baseTokenName})
            </TableHead>
            <TableHead className="bg-primary text-neutral-100">Buyer</TableHead>
            <TableHead className="bg-primary text-neutral-100">Seller</TableHead>
            <TableHead className="bg-primary text-neutral-100 text-right">
              Total ({selectedMarket?.quoteTokenName})
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{renderTableContent()}</TableBody>
      </Table>
    </div>
  );
}
