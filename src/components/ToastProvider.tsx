/**
 * ToastProvider.tsx
 * Global toast notification provider using Sonner
 */

import { Toaster } from 'sonner';

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'rgb(31, 41, 55)',
          border: '1px solid rgb(55, 65, 81)',
          color: 'white',
        },
        className: 'font-sans',
      }}
      theme="dark"
      closeButton
      richColors
    />
  );
}
