import { useEffect, useState } from 'react';

/** The current time, refreshed every `stepMs` so countdowns stay current. */
export function useNow(stepMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), stepMs);
    return () => window.clearInterval(id);
  }, [stepMs]);
  return now;
}
