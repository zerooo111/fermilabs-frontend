/** Shared vault constants and URL state. */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { Vault, VaultMode, VaultWindow } from '../api/vaultsClient';

export const WINDOWS: { value: VaultWindow; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'all', label: 'All' },
];

export const MODE_LABEL: Record<VaultMode, string> = {
  'pre-deposit': 'Pre-deposit',
  live: 'Live',
  unwind: 'Unwinding',
  closed: 'Closed',
};

export function vaultHref(v: Pick<Vault, 'network' | 'address'>) {
  return `/vaults/${v.network}/${v.address}`;
}

/** `?window=` with 30d as the default (omitted from the URL). */
export function useWindowParam() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('window');
  const window = (WINDOWS.some(w => w.value === raw) ? raw : '30d') as VaultWindow;
  const setWindow = useCallback(
    (v: VaultWindow) =>
      setParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (v === '30d') next.delete('window');
          else next.set('window', v);
          return next;
        },
        { replace: true }
      ),
    [setParams]
  );
  return { window, setWindow };
}
