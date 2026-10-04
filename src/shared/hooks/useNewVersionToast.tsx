/**
 * useNewVersionToast.tsx
 * Tells a long-open tab that a newer deploy of the app is live. Each build
 * publishes /version.json with its id (vite.config.js); when the live id stops
 * matching the one this bundle was built with, a toast offers a reload.
 */
import { useEffect } from 'react';
import { toast } from 'sonner';
import { NewVersionToast } from '@/shared/ui/NewVersionToast';

const CHECK_INTERVAL_MS = 2 * 60 * 1000;
const TOAST_ID = 'new-version';

async function fetchLiveBuild(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { build?: unknown };
    return typeof body.build === 'string' ? body.build : null;
  } catch {
    return null;
  }
}

function showNewVersionToast() {
  toast.custom(id => <NewVersionToast toastId={id} />, {
    id: TOAST_ID,
    duration: Infinity,
    position: 'bottom-right',
    unstyled: true,
    style: { padding: 0, background: 'transparent', border: 'none' },
  });
}

export function useNewVersionToast() {
  useEffect(() => {
    // Dev builds have no version.json; HMR keeps them current anyway.
    if (!import.meta.env.PROD) return;

    let shown = false;
    const check = async () => {
      if (shown || document.visibilityState !== 'visible') return;
      const live = await fetchLiveBuild();
      if (live && live !== __BUILD_ID__) {
        shown = true;
        showNewVersionToast();
      }
    };

    // A deploy removes the old hashed chunks, so a lazy import from this tab
    // can 404 before the poll notices. Offer the reload instead of erroring.
    const onPreloadError = (event: Event) => {
      event.preventDefault();
      shown = true;
      showNewVersionToast();
    };
    const onVisible = () => void check();

    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('vite:preloadError', onPreloadError);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('vite:preloadError', onPreloadError);
    };
  }, []);
}
