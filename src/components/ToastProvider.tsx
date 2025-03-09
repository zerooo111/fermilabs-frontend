/**
 * ToastProvider.tsx
 * Global toast notification provider using Sonner
 */

import { Toaster } from 'sonner';

export function ToastProvider() {
  return <Toaster richColors position="bottom-center" theme="light" style={{ fontFamily: 'Geist Mono' }} />;
}
