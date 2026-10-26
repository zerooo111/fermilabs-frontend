/**
 * FLP vault deployment. FLP lives on its own devnet deployment, separate from
 * the cluster the rest of the app trades on, so it gets its own RPC.
 *
 * Addresses are from the RC6 devnet deployment (fermi-v1
 * flp-vault/docs/INTEGRATION_GUIDE.md "Devnet — RC6 vanity deployment",
 * mainnet/rc6/devnet/2026-10-26-runtime-artifact.json). They're kept here
 * rather than read from env so a stale build variable can't point the page at
 * a retired program. The RC4 vaults (program 5EJSS…) are not RC6 accounts.
 */
import { PublicKey } from '@solana/web3.js';

export const FLP_CLUSTER = 'devnet';
export const FLP_RPC_URL: string =
  import.meta.env.VITE_FLP_RPC_URL || 'https://api.devnet.solana.com';
/** Data API host. CORS is open and it needs no key. */
export const FLP_API_URL: string =
  import.meta.env.VITE_FLP_API_URL || 'https://flp.34-116-238-207.sslip.io';
/** Reader profile a data API response must carry for this deployment. */
export const FLP_API_PROFILE = 'rc6-devnet';

export const FLP_PROGRAM_ID = new PublicKey('FLPRrDPN5tJpLx6wY6FUiGFN5Kws8gHUCYMCcs6Goa9Q');
/** The approved devnet runtime core, not the canonical RC6 core (`RC6_RELEASE.coreProgram`). */
export const FLP_CORE_PROGRAM_ID = new PublicKey('6zuHzxwDsZHXSpNtgE4rru3e55n3DMPbMd3UBT31YuX5');

export interface FlpVaultConfig {
  id: number;
  address: PublicKey;
  name: string;
  /** The data API host's faucet mints this vault's test USDC. */
  faucet: boolean;
  /** The data API host's whitelist service approves direct deposits on this vault. */
  whitelist: boolean;
}

// RC6 has one vault, on a private test group with synthetic test USDC
// (BPmUCs…). The host's faucet and whitelist still serve the RC4 group.
export const FLP_VAULTS: readonly FlpVaultConfig[] = [
  {
    id: 1,
    address: new PublicKey('DSF7hKayWatQyRhuyr4UkrG3zUuNW6b1Q5VhW7BzrUhu'),
    name: 'Fermi Liquidity Provider (FLP)',
    faucet: false,
    whitelist: false,
  },
];

export function flpVaultConfig(address: string): FlpVaultConfig | undefined {
  return FLP_VAULTS.find(v => v.address.toBase58() === address);
}

/** Base decimals of the devnet perp markets; the data API gives lot sizes only. */
export const FLP_MARKET_BASE_DECIMALS: Record<number, number> = { 0: 6 };

export function flpExplorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${FLP_CLUSTER}`;
}

export function flpExplorerAddressUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=${FLP_CLUSTER}`;
}
