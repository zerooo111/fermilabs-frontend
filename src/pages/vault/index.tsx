/**
 * Vault page
 * Interface for interacting with the vault
 */
import { useCallback, useEffect, useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { ArrowDownIcon, ArrowUpIcon, WalletIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  Select,
  SelectValue,
} from '../../shared/ui/select';
import { Button } from '../../shared/ui/button';
import { NumberInput } from '../../shared/ui/number-input';

import { useVaultClient } from '../../features/vault-deposit';
import { checkOrCreateAssociatedTokenAccount } from '../../shared/lib/solana/helpers';
import axios from 'axios';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import { config, API_ROUTES, API_ROUTES_V2 } from '@/shared/config/constants';
import { Market } from '@/entities/market/model';
import {
  mapV2MetaToMarket,
  mapV2AccountBalances,
  type V2MetaEvent,
  type V2AccountEvent,
} from '@/shared/api/v2-adapter';
import { baseMint, quoteMint } from '@/shared/config/constants';
import { getTokenDecimals } from '@/shared/lib/token-decimals';

interface Token {
  mint: string;
  name: string;
  decimals: number;
}

function VaultPage() {
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const vaultClient = useVaultClient();
  const { publicKey } = useWallet();
  const [amountDeposited, setAmountDeposited] = useState<number>(0);
  const [inputAmount, setInputAmount] = useState<number>(0);
  const [tvl, setTvl] = useState<number>(0);

  // Fetch markets from API. v2 path returns {markets: [{market, meta}]} —
  // map each entry through the shared adapter so we get the same Market
  // shape the rest of the app consumes. Legacy v1 kept behind the flag
  // during migration.
  const { data: markets } = useQuery({
    queryKey: ['markets'],
    queryFn: async () => {
      let rawMarkets: Market[];
      if (config.devnet.useV2ReadLayer) {
        const url = `${config.devnet.gatewayUrl}${API_ROUTES_V2.markets}`;
        const response = await axios.get<{
          markets: Array<{ market: string; meta: Record<string, string> }>;
        }>(url);
        rawMarkets = (response.data?.markets ?? []).map(row => {
          const ev: V2MetaEvent = { market: row.market, meta: row.meta ?? {} };
          return mapV2MetaToMarket(ev);
        });
      } else {
        const url = `${config.devnet.gatewayUrl}${API_ROUTES.markets}`;
        const response = await axios.get(url);
        rawMarkets = response.data as Market[];
      }

      // Apply same override as market model for consistent token names
      return rawMarkets.map(market => {
        if (market.uuid === '6f9ee497-1756-5bbd-b512-36cee35add8f') {
          const suffix = market.kind === 'perp' ? 'Perps' : '';
          return {
            ...market,
            name: `SOL/USDC ${suffix}`.trim(),
          };
        }
        return market;
      });
    },
    refetchInterval: 30000,
  });

  // Extract unique tokens from markets
  const tokens = useMemo(() => {
    if (!markets || markets.length === 0) return [];

    const tokenMap = new Map<string, Token>();

    markets.forEach(market => {
      const [baseTokenName, quoteTokenName] = market.name
        .split(' ')[0]
        .split('/')
        .map((s: string) => s.trim());

      if (market.base_mint && !tokenMap.has(market.base_mint)) {
        tokenMap.set(market.base_mint, {
          mint: market.base_mint,
          name: baseTokenName || 'BASE',
          decimals: market.base_decimals,
        });
      }

      if (market.quote_mint && !tokenMap.has(market.quote_mint)) {
        tokenMap.set(market.quote_mint, {
          mint: market.quote_mint,
          name: quoteTokenName || 'QUOTE',
          decimals: market.quote_decimals,
        });
      }
    });

    return Array.from(tokenMap.values());
  }, [markets]);

  // Set default selected token when tokens are loaded (prefer USDC)
  useEffect(() => {
    if (tokens.length > 0 && !selectedToken) {
      const usdc = tokens.find(t => t.name === 'USDC');
      setSelectedToken(usdc ?? tokens[0]);
    }
  }, [tokens, selectedToken]);

  // Fetch user balances. v2 reads v1:balance:<owner>.{tokens,totals} via
  // /v2/snapshot/account — no /state/balances round-trip. Legacy kept behind
  // the flag during migration.
  const { data: balances } = useQuery({
    queryKey: ['userBalances', publicKey?.toBase58(), config.devnet.useV2ReadLayer],
    queryFn: async () => {
      if (!publicKey) return null;
      if (config.devnet.useV2ReadLayer) {
        const url = `${config.devnet.gatewayUrl}${API_ROUTES_V2.snapshot_account.replace('{owner}', publicKey.toBase58())}`;
        const response = await axios.get<V2AccountEvent>(url);
        return mapV2AccountBalances(response.data, {
          baseMint: baseMint.toBase58(),
          baseDecimals: config.devnet.baseDecimals ?? 9,
          quoteMint: quoteMint.toBase58(),
          quoteDecimals: config.devnet.quoteDecimals ?? 6,
        });
      }
      const url = `${config.devnet.gatewayUrl}${API_ROUTES.user_balances.replace('{pubkey}', publicKey.toBase58())}`;
      const response = await axios.get(url);
      return response.data as Record<string, { available: string; reserved: string }>;
    },
    enabled: !!publicKey,
    refetchInterval: 5000,
  });

  const tokenDecimals = selectedToken?.decimals ?? 6;
  const walletBalance =
    balances && selectedToken && balances[selectedToken.mint]
      ? parseFloat(balances[selectedToken.mint].available) / Math.pow(10, tokenDecimals)
      : 0;

  const depositTokens = async () => {
    if (!vaultClient || !selectedToken) {
      throw new Error('VAULT_CLIENT_NOT_FOUND');
    }

    const tokenMint = new PublicKey(selectedToken.mint);
    const amount = new BN(inputAmount).mul(new BN(Math.pow(10, selectedToken.decimals)));
    const ata = await checkOrCreateAssociatedTokenAccount(
      vaultClient.provider,
      tokenMint,
      vaultClient.walletPk
    );

    try {
      await vaultClient.deposit(amount, tokenMint, ata, vaultClient.walletPk);
      posthog.capture('vault_deposit', {
        token: selectedToken?.name,
        token_mint: selectedToken?.mint,
        amount: inputAmount,
        wallet: publicKey?.toBase58(),
      });
      setInputAmount(0);
      getData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(errorMessage);
      posthog.capture('vault_deposit_failed', {
        token: selectedToken?.name,
        token_mint: selectedToken?.mint,
        amount: inputAmount,
        error_message: errorMessage,
        wallet: publicKey?.toBase58(),
      });
    }
  };

  const withdrawTokens = async () => {
    if (!vaultClient || !selectedToken) {
      throw new Error('VAULT_CLIENT_NOT_FOUND');
    }

    const tokenMint = new PublicKey(selectedToken.mint);
    const amount = new BN(inputAmount).mul(new BN(Math.pow(10, selectedToken.decimals)));
    const ata = await checkOrCreateAssociatedTokenAccount(
      vaultClient.provider,
      tokenMint,
      vaultClient.walletPk
    );

    try {
      await vaultClient.withdraw(amount, tokenMint, ata, vaultClient.walletPk);
      posthog.capture('vault_withdraw', {
        token: selectedToken?.name,
        token_mint: selectedToken?.mint,
        amount: inputAmount,
        wallet: publicKey?.toBase58(),
      });
      setInputAmount(0);
      getData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(errorMessage);
      posthog.capture('vault_withdraw_failed', {
        token: selectedToken?.name,
        token_mint: selectedToken?.mint,
        amount: inputAmount,
        error_message: errorMessage,
        wallet: publicKey?.toBase58(),
      });
    }
  };

  const handleAirdrop = async () => {
    if (!publicKey || !selectedToken) return;

    const url = `${config.devnet.gatewayUrl}/rollup/airdrop`;

    // Default airdrop amount based on token decimals (e.g., 1000 tokens)
    const decimals = getTokenDecimals(selectedToken.name);
    const amount = 1000 * Math.pow(10, decimals);

    const promise = axios
      .post(url, {
        recipient: publicKey.toBase58(),
        token_mint: selectedToken.mint,
        amount: amount,
      })
      .then(res => res.data);

    toast.promise(promise, {
      loading: 'Airdrop Request Initiated - Waiting for approval...',
      success: data => {
        getData();
        // Refresh balance after 2 seconds to ensure API has updated
        setTimeout(() => getData(), 2000);
        return (
          <div className="flex flex-col gap-1">
            <div>
              <strong>Airdrop Request Confirmed</strong>
            </div>
            <div>
              Sent {(amount / Math.pow(10, decimals)).toLocaleString()} {selectedToken.name}
            </div>
            {data?.transaction_id && (
              <div className="text-xs">TX: {data.transaction_id.slice(0, 8)}...</div>
            )}
          </div>
        );
      },
      error: (err: any) => (
        <div className="flex flex-col gap-1">
          <div>
            <strong>Airdrop Request Failed</strong>
          </div>
          <div>{err?.response?.data?.error || err?.message || 'Request failed'}</div>
        </div>
      ),
    });
  };

  const getData = useCallback(async () => {
    try {
      if (!vaultClient || !selectedToken) {
        return;
      }

      setInputAmount(0);
      setTvl(0);
      setAmountDeposited(0);

      const tokenMint = new PublicKey(selectedToken.mint);
      const decimals = selectedToken.decimals;
      const [vaultStatePda] = await vaultClient.getVaultStatePDA(tokenMint);

      vaultClient.getVaultTokenAccount(vaultStatePda).then(vaultTokenAccount => {
        const tvl = Number(vaultTokenAccount.amount) / Math.pow(10, decimals);
        setTvl(tvl);
      });

      await vaultClient?.getUserState(vaultClient.walletPk, vaultStatePda).then(userState => {
        const userDeposit = new BN(userState?.amountDeposited).div(new BN(Math.pow(10, decimals)));
        setAmountDeposited(userDeposit.toNumber());
      });
    } catch {
      // Silent error handling
    }
  }, [selectedToken, vaultClient]);

  useEffect(() => {
    getData();
  }, [getData]);

  // Reset input when switching tabs
  useEffect(() => {
    setInputAmount(0);
  }, [activeTab]);

  const maxAmount = activeTab === 'deposit' ? walletBalance : amountDeposited;
  const isButtonDisabled = inputAmount === 0 || inputAmount > maxAmount;

  return (
    <div className="flex flex-col min-h-[calc(100vh-60px)] px-4 py-8">
      <div className="max-w-lg mx-auto w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Vault</h1>
          <p className="text-white/60">Deposit assets to earn yield</p>
        </div>

        {/* Main Card */}
        <div className="border border-outline bg-card/20 backdrop-blur">
          {/* Token Selector */}
          <div className="p-4 border-b border-outline">
            <Select
              value={selectedToken?.mint ?? ''}
              onValueChange={value => {
                const token = tokens.find(t => t.mint === value);
                if (token) setSelectedToken(token);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                {tokens.map(token => (
                  <SelectItem key={token.mint} value={token.mint}>
                    {token.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 divide-x divide-outline border-b border-outline">
            <div className="p-4 text-center">
              <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Total Deposited</p>
              <p className="text-xl font-mono font-semibold">
                {tvl.toLocaleString()}
                <span className="text-sm text-white/50 ml-1">{selectedToken?.name}</span>
              </p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xs text-white/50 uppercase tracking-wide mb-1">FLP APR</p>
              <p className="text-xl font-mono font-semibold text-success">12%</p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="grid grid-cols-2 border-b border-outline">
            <button
              onClick={() => setActiveTab('deposit')}
              className={`py-3 text-sm font-medium transition-colors ${
                activeTab === 'deposit'
                  ? 'bg-white/5 text-white border-b-2 border-white'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              <ArrowDownIcon className="w-4 h-4 inline-block mr-2" />
              Deposit
            </button>
            <button
              onClick={() => setActiveTab('withdraw')}
              className={`py-3 text-sm font-medium transition-colors ${
                activeTab === 'withdraw'
                  ? 'bg-white/5 text-white border-b-2 border-white'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              <ArrowUpIcon className="w-4 h-4 inline-block mr-2" />
              Withdraw
            </button>
          </div>

          {/* Input Section */}
          <div className="p-4 space-y-4">
            {/* Balance Display */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-white/60">
                <WalletIcon className="w-4 h-4" />
                <span>{activeTab === 'deposit' ? 'Available' : 'Deposited'}</span>
              </div>
              <button
                onClick={() => setInputAmount(maxAmount)}
                className="font-mono hover:text-white transition-colors"
              >
                {maxAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: tokenDecimals,
                })}{' '}
                {selectedToken?.name}
              </button>
            </div>

            {/* Amount Input */}
            <NumberInput
              id="amount"
              name="amount"
              placeholder="0.00"
              unit={selectedToken?.name}
              value={inputAmount.toString()}
              onValueChange={values => setInputAmount(values.floatValue ?? 0)}
              decimalScale={tokenDecimals}
              allowNegative={false}
            />

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map(percent => (
                <button
                  key={percent}
                  onClick={() => setInputAmount((maxAmount * percent) / 100)}
                  className="py-2 text-xs font-medium bg-white/5 hover:bg-white/10 border border-outline transition-colors"
                >
                  {percent}%
                </button>
              ))}
            </div>

            {/* Action Button */}
            {!publicKey ? (
              <div className="py-3 text-center text-white/50 border border-outline bg-white/5">
                Connect wallet to continue
              </div>
            ) : (
              <Button
                className="w-full"
                onClick={activeTab === 'deposit' ? depositTokens : withdrawTokens}
                disabled={isButtonDisabled}
              >
                {activeTab === 'deposit' ? (
                  <>
                    <ArrowDownIcon className="w-4 h-4 mr-2" />
                    Deposit {selectedToken?.name}
                  </>
                ) : (
                  <>
                    <ArrowUpIcon className="w-4 h-4 mr-2" />
                    Withdraw {selectedToken?.name}
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Your Position */}
          {publicKey && amountDeposited > 0 && (
            <div className="p-4 border-t border-outline bg-white/5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Your Position</span>
                <span className="font-mono font-semibold">
                  {amountDeposited.toLocaleString()} {selectedToken?.name}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Airdrop Button (Devnet) */}
        {publicKey && selectedToken && (
          <button
            onClick={handleAirdrop}
            className="w-full py-3 text-sm text-white/60 hover:text-white border border-dashed border-outline hover:border-white/40 transition-colors"
          >
            Request {selectedToken.name} Airdrop (Devnet)
          </button>
        )}
      </div>
    </div>
  );
}

export default VaultPage;
