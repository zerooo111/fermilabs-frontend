/**
 * AppProviders.tsx
 * Combines all application providers in one component
 */
import { WalletContextProvider } from '@/entities/wallet';
import { AccessGateProvider } from '@/features/access-gate';
import { WaitlistDialog } from '@/features/waitlist';
import { QueryProvider } from './QueryProvider';
import { ToastProvider } from './ToastProvider';
import { PostHogProvider } from './PostHogProvider';

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders = ({ children }: AppProvidersProps) => {
  return (
    <PostHogProvider>
      <QueryProvider>
        <WalletContextProvider>
          <AccessGateProvider>
            {children}
            <WaitlistDialog />
            <ToastProvider />
          </AccessGateProvider>
        </WalletContextProvider>
      </QueryProvider>
    </PostHogProvider>
  );
};
