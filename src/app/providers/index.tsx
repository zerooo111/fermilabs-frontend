/**
 * AppProviders.tsx
 * Combines all application providers in one component
 */
import { WalletContextProvider } from '@/entities/wallet';
import { QueryProvider } from './QueryProvider';
import { ToastProvider } from './ToastProvider';

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders = ({ children }: AppProvidersProps) => {
  return (
    <QueryProvider>
      <WalletContextProvider>
        {children}
        <ToastProvider />
      </WalletContextProvider>
    </QueryProvider>
  );
};
