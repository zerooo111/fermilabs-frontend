/**
 * ToastProvider.tsx
 * Global toast notification provider using Sonner
 */

import { Toaster } from 'sonner';
import { useNewVersionToast } from '@/shared/hooks/useNewVersionToast';

export function ToastProvider() {
  useNewVersionToast();

  return (
    <Toaster
      richColors
      position="bottom-center"
      theme="dark"
      style={{ fontFamily: 'Geist Mono' }}
      toastOptions={{
        className: 'backdrop-blur-2xl !rounded-none',
        style: {
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          color: '#ffffff',
        },
      }}
    />
  );
}
