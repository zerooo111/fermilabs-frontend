/**
 * My assets component
 * Displays the user's asset balances
 */
import { useWallet } from '@solana/wallet-adapter-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { getTokenDecimals } from '@/shared/lib/token-decimals';
import { config, API_ROUTES } from '@/shared/config/constants';
import { Address } from '@coral-xyz/anchor';
import { Button } from '@/shared/ui/button';
import { toast } from 'sonner';

interface TokenBalance {
  available: string;
  reserved: string;
}

type BalanceData = Record<string, TokenBalance>;

export function MyAssets() {
  const { publicKey } = useWallet();

  const { data, isLoading } = useQuery({
    queryKey: ['userBalances', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return null;
      const url = `${config.devnet.apiBaseUrl}${API_ROUTES.user_balances.replace('{pubkey}', publicKey.toBase58())}`;
      const response = await axios.get(url);
      return response.data as BalanceData;
    },
    enabled: !!publicKey,
    refetchInterval: 5000, // Refetch every 5 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  const requestAirdrop = async (mintAddress: Address) => {
    const url = `${config.devnet.apiBaseUrl}${API_ROUTES.airdrop
      .replace('{receiverPubKey}', publicKey?.toBase58() || '')
      .replace('{tokenName}', mintAddress)}`;
    const promise = axios.post(url).then(res => res.data.data);

    toast.promise(promise, {
      loading: 'Airdrop Request Initiated - Waiting for approval...',
      success: () => (
        <div className="flex flex-col gap-1">
          <div>
            <strong>Airdrop Request Confirmed</strong>
          </div>
          <div>Request completed successfully</div>
        </div>
      ),
      error: (err: Error) => (
        <div className="flex flex-col gap-1">
          <div>
            <strong>Airdrop Request Failed</strong>
          </div>
          <div>{err?.message || 'Request failed'}</div>
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
      // Try to get token name from mint address (simplified - you may want a better lookup)
      const tokenName = 'USDC'; // Default to USDC for now
      const decimals = getTokenDecimals(tokenName);

      const available = parseFloat(balance.available);
      const reserved = parseFloat(balance.reserved);
      const total = available + reserved;

      const availableFormatted = (available / Math.pow(10, decimals)).toFixed(decimals);
      const reservedFormatted = (reserved / Math.pow(10, decimals)).toFixed(decimals);
      const totalFormatted = (total / Math.pow(10, decimals)).toFixed(decimals);

      return (
        <TableRow key={mint} className="text-white/90">
          <TableCell className="font-medium">{tokenName}</TableCell>
          <TableCell className="text-center font-mono tabular-nums">{availableFormatted}</TableCell>
          <TableCell className="text-center font-mono tabular-nums">{reservedFormatted}</TableCell>
          <TableCell className="text-center font-mono tabular-nums">{totalFormatted}</TableCell>
          <TableCell className="font-mono text-right">
            <div className="flex items-center justify-end gap-2">
              {mint.slice(0, 8)}...{mint.slice(-8)}
              <Button variant={'outline'} size="sm" onClick={() => requestAirdrop(mint as Address)}>
                Request airdrop
              </Button>
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
