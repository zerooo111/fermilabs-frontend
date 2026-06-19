/**
 * My trades component.
 * Only active while its TabsContent is mounted — Radix unmounts inactive
 * tabs, so switching away cancels the in-flight REST fetch and stops
 * reading the live atom without touching the shared SSE client.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue } from 'jotai';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { selectedMarketAtom } from '@/entities/market/model';
import {
  formatPrice,
  formatQuantity,
  formatTotal,
} from '@/features/orderbook-view/lib/processOrderbook';
import { userTradesAtom } from '@/shared/api/sse-atoms';
import { fetchWalletTrades } from '@/shared/api/walletTrades';
import { mapWalletTradesForMarket } from '@/shared/api/sse-atom-bridge';
import { shortenAddress } from '@/shared/lib/solana/helpers';
import type { SSETrade } from '@/shared/api/sse-types';
import type { Trade } from '@/shared/api/useSequencerApi';

const PAGE_SIZE = 50;

function StatusRow({ children, tone }: { children: ReactNode; tone?: 'danger' }) {
  return (
    <TableRow>
      <TableCell
        colSpan={7}
        className={`h-24 text-center text-sm ${tone === 'danger' ? 'text-danger' : 'text-muted-foreground'}`}
      >
        {children}
      </TableCell>
    </TableRow>
  );
}

export function MyTrades() {
  const { publicKey } = useWallet();
  const selectedMarket = useAtomValue(selectedMarketAtom);
  const liveTrades = useAtomValue(userTradesAtom);

  const [history, setHistory] = useState<SSETrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pubkeyStr = publicKey?.toBase58() ?? null;
  const marketId = selectedMarket?.uuid ?? null;

  useEffect(() => {
    if (!pubkeyStr || !marketId) {
      setHistory([]);
      setHasMore(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setHistory([]);
    setHasMore(false);

    fetchWalletTrades(pubkeyStr, {
      market: marketId,
      limit: PAGE_SIZE,
      signal: controller.signal,
    })
      .then(trades => {
        if (controller.signal.aborted) return;
        setHistory(trades);
        setHasMore(trades.length === PAGE_SIZE);
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load trades');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [pubkeyStr, marketId]);

  const loadMore = async () => {
    if (!pubkeyStr || !marketId || loadingMore) return;
    const oldest = history[history.length - 1];
    if (!oldest) return;

    setLoadingMore(true);
    setError(null);
    try {
      const next = await fetchWalletTrades(pubkeyStr, {
        market: marketId,
        limit: PAGE_SIZE,
        before: oldest.ts_ms,
      });
      setHistory(prev => [...prev, ...next]);
      setHasMore(next.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more trades');
    } finally {
      setLoadingMore(false);
    }
  };

  const historyTrades = useMemo<Trade[]>(
    () =>
      selectedMarket && history.length > 0 ? mapWalletTradesForMarket(history, selectedMarket) : [],
    [history, selectedMarket]
  );

  const mergedTrades = useMemo<Trade[]>(() => {
    if (!selectedMarket) return [];
    const seen = new Set<string>();
    const out: Trade[] = [];
    for (const t of liveTrades) {
      if (t.id && seen.has(t.id)) continue;
      if (t.id) seen.add(t.id);
      out.push(t);
    }
    for (const t of historyTrades) {
      if (t.id && seen.has(t.id)) continue;
      if (t.id) seen.add(t.id);
      out.push(t);
    }
    out.sort((a, b) => b.timestamp - a.timestamp);
    return out;
  }, [liveTrades, historyTrades, selectedMarket]);

  if (!publicKey) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-medium">Please connect your wallet</h2>
      </div>
    );
  }

  const renderBody = () => {
    if (loading && mergedTrades.length === 0) {
      return <StatusRow>Loading trades…</StatusRow>;
    }
    if (error && mergedTrades.length === 0) {
      return <StatusRow tone="danger">{error}</StatusRow>;
    }
    if (mergedTrades.length === 0) {
      return <StatusRow>No trades found</StatusRow>;
    }

    return mergedTrades.map(trade => {
      // Prefer the server-resolved wallet side. Trades are keyed by
      // mango-account address, not the wallet pubkey, so comparing owners to
      // `pubkeyStr` never matches and would mislabel every row as "Sell".
      // Fall back to the owner comparison only when the server didn't provide
      // a side (legacy rows).
      const isBuyer =
        trade.wallet_side != null ? trade.wallet_side === 'buy' : trade.buyer_owner === pubkeyStr;
      const side = isBuyer ? 'Buy' : 'Sell';

      return (
        <TableRow key={trade.id}>
          <TableCell>{new Date(trade.timestamp * 1000).toLocaleString()}</TableCell>
          <TableCell>
            <Badge variant={side === 'Buy' ? 'success' : 'danger'}>{side}</Badge>
          </TableCell>
          <TableCell className="font-mono">
            {formatPrice(trade.price, selectedMarket!.quoteDecimals)}{' '}
            {selectedMarket!.quoteTokenName}
          </TableCell>
          <TableCell className="font-mono">
            {formatQuantity(trade.quantity, selectedMarket!.baseDecimals)}{' '}
            {selectedMarket!.baseTokenName}
          </TableCell>
          <TableCell className="font-mono">
            <span className={isBuyer ? 'text-success' : ''}>
              {shortenAddress(trade.buyer_owner)}
            </span>
          </TableCell>
          <TableCell className="font-mono">
            <span className={!isBuyer ? 'text-danger' : ''}>
              {shortenAddress(trade.seller_owner)}
            </span>
          </TableCell>
          <TableCell className="text-right font-mono">
            {formatTotal(
              trade.price,
              trade.quantity,
              selectedMarket!.quoteDecimals,
              selectedMarket!.baseDecimals
            )}{' '}
            {selectedMarket!.quoteTokenName}
          </TableCell>
        </TableRow>
      );
    });
  };

  return (
    <>
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
        <TableBody>{renderBody()}</TableBody>
      </Table>

      {mergedTrades.length > 0 && (hasMore || error) && (
        <div className="flex items-center justify-center gap-3 p-3 border-t border-outline">
          {error && <span className="text-xs text-danger">{error}</span>}
          {hasMore && (
            <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
