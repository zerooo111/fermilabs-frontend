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
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  });

  if (!publicKey) {
    return (
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-medium">Please connect your wallet</h2>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-medium">My Trades</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading trades...
        </div>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-medium">My Trades</h2>
        <div className="text-sm text-muted-foreground">No trades found</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="text-lg font-medium">My Trades</h2>
      <div className="rounded-md border w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="bg-accent rounded-tl-md">Time</TableHead>
              <TableHead className="bg-accent">Side</TableHead>
              <TableHead className="bg-accent">Price</TableHead>
              <TableHead className="bg-accent">Size</TableHead>
              <TableHead className="bg-accent">Role</TableHead>
              <TableHead className="bg-accent text-right rounded-tr-md">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map(trade => (
              <TableRow key={trade.id} className="text-xs">
                <TableCell>{new Date(trade.timestamp).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={trade.side === 'Buy' ? 'success' : 'danger'}>{trade.side}</Badge>
                </TableCell>
                <TableCell className="font-mono">
                  {Number(trade.price / 10 ** 9).toPrecision(4)}
                </TableCell>
                <TableCell className="font-mono">
                  {Number(trade.size / 10 ** 9).toPrecision(4)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {trade.maker === publicKey.toBase58() ? 'Maker' : 'Taker'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {Number((trade.price * trade.size) / 10 ** 18).toPrecision(4)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
