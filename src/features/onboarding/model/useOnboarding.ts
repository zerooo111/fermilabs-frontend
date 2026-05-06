import { useState, useCallback } from 'react';

const KEY_PREFIX = 'fermi_onboarding_v1_';

/**
 * Returns whether the onboarding guide should be shown for a given wallet,
 * and a stable `dismiss` callback that persists the decision to localStorage.
 */
export function useOnboarding(walletKey: string | null) {
  const storageKey = walletKey ? `${KEY_PREFIX}${walletKey}` : null;

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (!storageKey) return true;
    return !!localStorage.getItem(storageKey);
  });

  const dismiss = useCallback(() => {
    if (storageKey) localStorage.setItem(storageKey, '1');
    setDismissed(true);
  }, [storageKey]);

  return { shouldShow: !dismissed, dismiss };
}
