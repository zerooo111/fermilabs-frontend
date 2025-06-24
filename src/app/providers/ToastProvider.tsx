/**
 * ToastProvider.tsx
 * Global toast notification provider using Sonner
 */

import { Toaster } from 'sonner';

export function ToastProvider() {
  return (
    <Toaster
      richColors
      position="bottom-center"
      theme="dark"
      style={{ fontFamily: 'Geist Mono' }}
      toastOptions={{
        style: {
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          color: '#ffffff',
        },
      }}
    />
  );
}
