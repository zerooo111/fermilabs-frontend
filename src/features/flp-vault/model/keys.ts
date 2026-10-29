/**
 * Query and mutation keys for FLP. Everything about one vault sits under
 * `['flp', vault]`, so one prefix invalidates or cancels all of it.
 */
export const flpKeys = {
  all: ['flp'] as const,
  vault: (vault: string) => ['flp', vault] as const,
  /** Data API reads; `owner` '' is the wallet-less read. */
  data: (vault: string, owner: string | null) => ['flp', vault, 'data', owner ?? ''] as const,
  dataAll: (vault: string) => ['flp', vault, 'data'] as const,
  /** RPC wallet balances (SOL, USDC, FLP). */
  wallet: (vault: string, owner: string) => ['flp', vault, 'wallet', owner] as const,
  walletAll: (vault: string) => ['flp', vault, 'wallet'] as const,
  orders: (vault: string, market: number) => ['flp', vault, 'orders', market] as const,
  /** The vault's Fermi account's fills, from the gateway. */
  trades: (vault: string) => ['flp', vault, 'trades'] as const,
  /** Mutation key of the vault's user transactions: one in flight at a time. */
  tx: (vault: string) => ['flp', vault, 'tx'] as const,
};

/** The data API keeps each response this long; a read sooner gets the same body. */
export const API_CACHE_MS = 3_500;
