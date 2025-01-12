/**
 * useNotification.tsx
 * Custom hook for managing toast notifications
 */

import { toast } from 'sonner';
import { getExplorerUrl } from '../utils/explorer';
import { ReactNode } from 'react';

interface NotificationOptions {
  duration?: number;
  description?: string | ReactNode;
}

interface TransactionToastOptions {
  txName?: string;
}

export function useNotification() {
  const showTransactionToast = async <T extends string>(
    promise: Promise<T>,
    options?: TransactionToastOptions
  ): Promise<T> => {
    const txName = options?.txName || 'Transaction';

    toast.promise(promise, {
      loading: `${txName} Initiated - Waiting for approval...`,
      success: (signature: T) => (
        <div className="flex flex-col gap-1">
          <div>
            <strong>{txName} Confirmed</strong>
          </div>
          <div>Transaction confirmed successfully</div>
          <a
            href={getExplorerUrl(signature)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-sm underline"
          >
            View on Explorer ↗
          </a>
        </div>
      ),
      error: (err: Error) => (
        <div className="flex flex-col gap-1">
          <div>
            <strong>{txName} Failed</strong>
          </div>
          <div>{err?.message || 'Transaction failed to confirm'}</div>
        </div>
      ),
    });

    return promise;
  };

  return {
    success: (message: string, options?: NotificationOptions) => {
      toast.success(message, {
        duration: options?.duration || 4000,
        description: options?.description,
      });
    },

    error: (message: string, options?: NotificationOptions) => {
      toast.error(message, {
        duration: options?.duration || 6000,
        description: options?.description,
      });
    },

    info: (message: string, options?: NotificationOptions) => {
      toast.info(message, {
        duration: options?.duration || 4000,
        description: options?.description,
      });
    },

    warning: (message: string, options?: NotificationOptions) => {
      toast.warning(message, {
        duration: options?.duration || 5000,
        description: options?.description,
      });
    },

    loading: (message: string, options?: NotificationOptions) => {
      return toast.loading(message, {
        duration: options?.duration,
        description: options?.description,
      });
    },

    transaction: showTransactionToast,
  };
}
