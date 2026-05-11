/**
 * My assets component
 * Displays the user's asset balances
 */
import { useWallet } from '@solana/wallet-adapter-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  getTokenNameFromMint,
  getDecimalsFromMint,
  getTokenDecimals,
} from '@/shared/lib/token-decimals';
import { Button } from '@/shared/ui/button';
import { toast } from 'sonner';
import { useSequencerApi } from '@/shared/api/useSequencerApi';
import { useSelectedMarket } from '@/entities/market';
import { useMangoMarginDeposit } from '@/shared/hooks/useMangoMarginDeposit';

interface TokenBalance {
  available: string;
  reserved: string;
}

type BalanceData = Record<string, TokenBalance>;

export function MyAssets() {
  const { publicKey } = useWallet();
  const { selectedMarket } = useSelectedMarket();
  const { fetchUserBalances, requestAirdrop } = useSequencerApi();
  const { depositMargin } = useMangoMarginDeposit();

  const { data, isLoading } = useQuery({
    queryKey: ['userBalances', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return null;
      return (await fetchUserBalances(publicKey.toBase58())) as BalanceData;
    },
    enabled: !!publicKey,
    refetchInterval: 1000, // Refetch every 1 second
    staleTime: 1000, // Keep cache fresh when switching tabs
  });

  const handleAirdrop = async () => {
    if (!publicKey) {
      return;
    }
    const promise = requestAirdrop(publicKey.toBase58());

    toast.promise(promise, {
      loading: 'Minting test USDC...',
      success: data => (
        <div className="flex flex-col gap-1">
          <div>
            <strong>Airdrop Complete</strong>
          </div>
          <div>
            Minted {(data?.ui_amount ?? 0).toLocaleString()}{' '}
            {selectedMarket?.quoteTokenName ?? 'USDC'}
          </div>
        </div>
      ),
      error: (err: any) => (
        <div className="flex flex-col gap-1">
          <div>
            <strong>Airdrop Failed</strong>
          </div>
          <div>{err?.response?.data?.error || err?.message || 'Request failed'}</div>
        </div>
      ),
    });
  };

  const handleFundMargin = async () => {
    if (!publicKey) {
      return;
    }
    const promise = depositMargin();

    toast.promise(promise, {
      loading: 'Funding margin account...',
      success: data => (
        <div className="flex flex-col gap-1">
          <div>
            <strong>Margin Funded</strong>
          </div>
          <div>
            Deposited {(data?.uiAmount ?? 0).toLocaleString()}{' '}
            {selectedMarket?.quoteTokenName ?? 'USDC'}
          </div>
          {data?.autoCreatedMangoAccount && <div className="text-xs">Created Fermi account</div>}
        </div>
      ),
      error: (err: any) => (
        <div className="flex flex-col gap-1">
          <div>
            <strong>Funding Failed</strong>
          </div>
          <div>{err?.response?.data?.error || err?.message || 'Request failed'}</div>
        </div>
      ),
    });
  };

  if (!publicKey) {
    return (
      <div>
        <h2 className="text-lg font-medium">Please connect your wallet</h2>
      </div>
    );
  }

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead className="text-right">Available</TableHead>
            <TableHead className="text-right">Locked</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Mint Address</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={5} className="h-24 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading balances...
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  const balances = data || {};

  const renderTableContent = () => {
    const assetEntries = Object.entries(balances);

    if (assetEntries.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
            No assets found
          </TableCell>
        </TableRow>
      );
    }

    return assetEntries.map(([mint, balance]) => {
      // Get token name and decimals from mint address registry
      const tokenName = getTokenNameFromMint(mint) ?? 'Unknown';
      const decimals = getDecimalsFromMint(mint) ?? getTokenDecimals(tokenName);

      const available = parseFloat(balance.available);
      const reserved = parseFloat(balance.reserved);
      const total = available + reserved;

      const availableFormatted = (available / Math.pow(10, decimals)).toFixed(decimals);
      const reservedFormatted = (reserved / Math.pow(10, decimals)).toFixed(decimals);
      const totalFormatted = (total / Math.pow(10, decimals)).toFixed(decimals);

      const isQuoteAsset = mint === selectedMarket?.quote_mint;

      return (
        <TableRow key={mint} className="text-white/90">
          <TableCell className="font-medium">{tokenName}</TableCell>
          <TableCell className="text-center font-mono tabular-nums">{availableFormatted}</TableCell>
          <TableCell className="text-center font-mono tabular-nums">{reservedFormatted}</TableCell>
          <TableCell className="text-center font-mono tabular-nums">{totalFormatted}</TableCell>
          <TableCell className="font-mono text-right">
            <div className="flex items-center justify-end gap-2">
              {mint.slice(0, 8)}...{mint.slice(-8)}
              {isQuoteAsset && (
                <>
                  <Button variant="outline" size="sm" onClick={handleAirdrop}>
                    Airdrop
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleFundMargin}>
                    Deposit
                  </Button>
                </>
              )}
            </div>
          </TableCell>
        </TableRow>
      );
    });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Asset</TableHead>
          <TableHead className="text-center">Available</TableHead>
          <TableHead className="text-center">Reserved</TableHead>
          <TableHead className="text-center">Total</TableHead>
          <TableHead className="text-right">Mint Address</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{renderTableContent()}</TableBody>
    </Table>
  );
}
