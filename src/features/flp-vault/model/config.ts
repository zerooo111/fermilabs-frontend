/**
 * FLP vault deployment: RC6.1 on Solana mainnet (fermi-v1
 * flp-vault/docs/INTEGRATION_GUIDE.md "Mainnet — RC6.1",
 * mainnet-deployed-rc6.1.md, and the SDK's `RC6_MAINNET_RELEASE` pins).
 *
 * The vault trades on its own Fermi r9 group (core FRMiX94…, group 2mDvxS4A…),
 * not the main dashboard's, so its data comes from a separate FLP-only reader,
 * which the gateway passes through.
 * Transactions go through the app's mainnet RPC and Privy wallet. Addresses are
 * kept here rather than read from env so a stale build variable can't point
 * the page at the devnet deployment (same program ID, other cluster).
 */
import { PublicKey } from '@solana/web3.js';

import { config } from '@/shared/config/constants';

import { RC6_MAINNET_RELEASE } from '../sdk';

export const FLP_CLUSTER = 'mainnet';
/** The app's RPC: FLP is on the same cluster as trading. */
export const FLP_RPC_URL: string = config.devnet.rpcUrl;
/**
 * The FLP-only mainnet reader (flp-mainnet.34-116-238-207.sslip.io), through
 * the gateway's `/v2/flp/mainnet` pass-through (same paths, status and body).
 * Same gateway as the vault history (vaultsClient.ts): staging by default,
 * since vault pages only exist where `showUnlaunched` is on.
 */
export const FLP_API_URL = `${import.meta.env.VITE_VAULTS_GATEWAY_URL || 'https://v1.fermi.trade/staging'}/v2/flp/${FLP_CLUSTER}`;
/** Reader profile a data API response must carry for this deployment. */
export const FLP_API_PROFILE = RC6_MAINNET_RELEASE.integrationProfile;

/** The same ID as devnet: the cluster is chosen by the RPC, not the program ID. */
export const FLP_PROGRAM_ID = new PublicKey(RC6_MAINNET_RELEASE.vaultProgram);
/** Fermi r9, the vault's core (not the main dashboard's core program). */
export const FLP_CORE_PROGRAM_ID = new PublicKey(RC6_MAINNET_RELEASE.coreProgram);

export interface FlpVaultConfig {
  id: number;
  address: PublicKey;
  name: string;
}

export const FLP_VAULTS: readonly FlpVaultConfig[] = [
  {
    id: RC6_MAINNET_RELEASE.vaultId,
    address: new PublicKey(RC6_MAINNET_RELEASE.vault),
    name: 'Fermi Liquidity Provider (FLP)',
  },
];

export function flpVaultConfig(address: string): FlpVaultConfig | undefined {
  return FLP_VAULTS.find(v => v.address.toBase58() === address);
}

/**
 * Announced graduation date (UTC), when every pre-deposit moves into the main
 * pool at one NAV per share. Not on chain: graduation is admin-triggered and
 * `lifecycle.graduation.scheduledAt` is null, so this is shown as an estimate.
 */
export const FLP_GRADUATION_ESTIMATE_MS = Date.UTC(2026, 10, 10);

/** "10 Nov", for copy that names the estimate. */
export const FLP_GRADUATION_ESTIMATE_LABEL = new Date(
  FLP_GRADUATION_ESTIMATE_MS
).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Base decimals of the r9 perp markets (SOL, ETH, BTC), from their PerpMarket
 * accounts; the data API gives lot sizes only.
 */
export const FLP_MARKET_BASE_DECIMALS: Record<number, number> = { 0: 5, 1: 6, 2: 6 };

export function flpExplorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}`;
}

export function flpExplorerAddressUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}`;
}
