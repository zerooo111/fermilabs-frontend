import { useEffect, useState } from 'react';
import { config, API_ROUTES_V2 } from '@/shared/config/constants';

const INTERVAL_MS = 15_000;
const TIMEOUT_MS = 5_000;

/**
 * Round-trip time to the gateway's health endpoint, sampled every 15s while the
 * tab is visible. The SSE feed is one-way, so it can't report latency itself.
 * Returns null until the first sample lands and after a failed probe.
 */
export function useGatewayLatency(): number | null {
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = `${config.devnet.gatewayUrl}${API_ROUTES_V2.healthz}`;

    const probe = async () => {
      if (document.visibilityState !== 'visible') return;
      const start = performance.now();
      try {
        const res = await fetch(url, {
          cache: 'no-store',
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(String(res.status));
        if (!cancelled) setLatency(performance.now() - start);
      } catch {
        if (!cancelled) setLatency(null);
      }
    };

    probe();
    const id = window.setInterval(probe, INTERVAL_MS);
    document.addEventListener('visibilitychange', probe);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', probe);
    };
  }, []);

  return latency;
}
