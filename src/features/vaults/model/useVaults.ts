/**
 * Vault data hooks. They read the dummy data today and keep the same return
 * shape a TanStack Query version will have, so the UI will not need to change
 * when the API arrives.
 */
import { useMemo } from 'react';

import { getMockVaults } from './mock';
import type { Vault } from './types';

export function useVaults(): { vaults: Vault[]; isLoading: boolean } {
  const vaults = useMemo(() => getMockVaults(), []);
  return { vaults, isLoading: false };
}

export function useVault(id: string | undefined): { vault: Vault | null; isLoading: boolean } {
  const { vaults } = useVaults();
  const vault = useMemo(() => vaults.find(v => v.id === id) ?? null, [vaults, id]);
  return { vault, isLoading: false };
}
