/**
 * JotaiDevTools.tsx
 * Development-only component for Jotai state debugging
 * Only renders in development mode
 */

import { DevTools } from 'jotai-devtools';
import 'jotai-devtools/styles.css';

export function JotaiDevTools() {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return <DevTools position="bottom-right" theme="dark" isInitialOpen={false} />;
}
