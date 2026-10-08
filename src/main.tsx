/**
 * Application entry point
 */
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { hideBootSplash } from '@/shared/lib/boot-splash';
import './index.css';

// A lazy chunk fails to load when a tab outlives a deploy (the chunk's hashed
// name is gone and Cloudflare answers with index.html) or during a deploy's
// rollout. Reload to pick up the current build. The timestamp guard allows one
// reload per 10s, so a chunk that is genuinely broken can't loop.
const RELOAD_KEY = 'chunk-reload-at';
window.addEventListener('vite:preloadError', event => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY));
    if (last && Date.now() - last < 10_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage blocked: without the guard a reload could loop, so let it surface
    return;
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(<App />);

// Routes hide the boot splash once they render (LazyRoutes) or fail
// (ErrorBoundary). This is the backstop for a crash outside either.
window.setTimeout(hideBootSplash, 15_000);
