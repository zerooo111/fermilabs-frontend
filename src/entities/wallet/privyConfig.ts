/**
 * privyConfig.ts
 * PrivyProvider configuration: external Solana wallets (Phantom, Solflare, …)
 * through Privy's modal, plus email/social login with embedded Solana wallets
 * when `embeddedWalletsEnabled` is on.
 */
import type { PrivyClientConfig } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
import { config } from '@/shared/config/constants';

type SolanaChain = 'solana:mainnet' | 'solana:devnet' | 'solana:testnet';

/**
 * Email/Google/X login with Privy embedded wallets. Off until embedded wallets
 * have deposit/withdraw flows; until then only regular wallets can trade.
 */
export const embeddedWalletsEnabled = false;

export const privyAppId: string = import.meta.env.VITE_PRIVY_APP_ID || '';
const privyClientId: string | undefined = import.meta.env.VITE_PRIVY_CLIENT_ID || undefined;

const rpcUrl = config.devnet.rpcUrl;
// VITE_WS_URL defaults to a devnet socket, so derive from the RPC URL unless set explicitly.
const wsUrl: string = import.meta.env.VITE_WS_URL || rpcUrl.replace(/^http/, 'ws');

export const privyChain: SolanaChain =
  (import.meta.env.VITE_SOLANA_CHAIN as SolanaChain | undefined) ||
  (/devnet/i.test(rpcUrl) ? 'solana:devnet' : 'solana:mainnet');

/** Solscan account page for the configured cluster. */
export function solscanAccountUrl(address: string): string {
  const cluster = privyChain === 'solana:mainnet' ? '' : `?cluster=${privyChain.slice(7)}`;
  return `https://solscan.io/account/${address}${cluster}`;
}

export const privyProviderProps = {
  appId: privyAppId,
  clientId: privyClientId,
  config: {
    loginMethods: embeddedWalletsEnabled ? ['email', 'google', 'twitter', 'wallet'] : ['wallet'],
    appearance: {
      theme: '#021a14',
      accentColor: '#b4dc78',
      logo: '/logo.svg',
      walletChainType: 'solana-only',
      showWalletLoginFirst: false,
    },
    embeddedWallets: {
      solana: { createOnLogin: embeddedWalletsEnabled ? 'users-without-wallets' : 'off' },
    },
    externalWallets: {
      solana: { connectors: toSolanaWalletConnectors() },
    },
    solana: {
      rpcs: {
        [privyChain]: {
          rpc: createSolanaRpc(rpcUrl),
          rpcSubscriptions: createSolanaRpcSubscriptions(wsUrl),
        },
      },
    },
  } satisfies PrivyClientConfig,
};
