/**
 * FLP vault deployment. FLP lives on its own devnet deployment, separate from
 * the cluster the rest of the app trades on, so it gets its own RPC.
 *
 * Addresses are from the RC4 gates build manifest
 * (`${FLP_API_URL}/deployment.json`, fermi-v1 flp-vault/docs/devnet-rc4.json).
 * They're kept here rather than read from env so a stale build variable can't
 * point the page at a retired program.
 */
import { PublicKey } from '@solana/web3.js';

export const FLP_CLUSTER = 'devnet';
/** Wallet-standard chain id that FLP transactions are signed for. */
export const FLP_CHAIN = `solana:${FLP_CLUSTER}` as const;
export const FLP_RPC_URL: string =
  import.meta.env.VITE_FLP_RPC_URL || 'https://api.devnet.solana.com';
/** Data API, faucet and whitelist host. CORS is open and it needs no key. */
export const FLP_API_URL: string =
  import.meta.env.VITE_FLP_API_URL || 'https://flp.34-116-238-207.sslip.io';

export const FLP_PROGRAM_ID = new PublicKey('5EJSSPcM4icUVcrGR7WwQzKDn915zCfAHaXnmAsFT7n2');
export const FLP_CORE_PROGRAM_ID = new PublicKey('6zuHzxwDsZHXSpNtgE4rru3e55n3DMPbMd3UBT31YuX5');

export interface FlpVaultConfig {
  id: number;
  address: PublicKey;
  name: string;
  /** The devnet whitelist service approves direct deposits on this vault. */
  whitelist: boolean;
}

// Vault 3 tests the phase before graduation, vault 1 the phase after it.
// Vault 2 is the operator's spare: don't list it.
export const FLP_VAULTS: readonly FlpVaultConfig[] = [
  {
    id: 3,
    address: new PublicKey('8fAqhdnBWnCN2nkkkX4qhU316bhhsvAtKRfoCAv1Hmgo'),
    name: 'Fermi Liquidity Provider (FLP)',
    whitelist: true,
  },
  {
    id: 1,
    address: new PublicKey('FXFEzgjZyFYcNvhAuCVhFw33qShzP659WG5wvZHXrPnL'),
    name: 'FLP Live Test',
    whitelist: false,
  },
];

export function flpVaultConfig(address: string): FlpVaultConfig | undefined {
  return FLP_VAULTS.find(v => v.address.toBase58() === address);
}

/** Base decimals of the devnet perp markets; the data API gives lot sizes only. */
export const FLP_MARKET_BASE_DECIMALS: Record<number, number> = { 0: 6, 1: 6, 2: 6 };

export function flpExplorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${FLP_CLUSTER}`;
}

export function flpExplorerAddressUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=${FLP_CLUSTER}`;
}
