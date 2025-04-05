/**
 * AppProviders.tsx
 * Combines all application providers in one component
 */
import { StrictMode } from 'react';
import { WalletContextProvider } from '../../entities/wallet';
import { QueryProvider } from './QueryProvider';
import { ToastProvider } from './ToastProvider';

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders = ({ children }: AppProvidersProps) => {
  return (
    <StrictMode>
      <QueryProvider>
        <WalletContextProvider>
          {children}
          <ToastProvider />
        </WalletContextProvider>
      </QueryProvider>
    </StrictMode>
  );
};
