/**
 * LazyRoutes.tsx
 * Defines lazy-loaded route components for code splitting
 */
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from '../../shared/ui/ErrorBoundary';

// Loading component for Suspense fallback
const LoadingPage = () => (
  <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
    <div className="text-lg text-muted-foreground">Loading...</div>
  </div>
);

// Lazy-loaded page components
export const TradePage = lazy(() => import('../../pages/trade'));
export const VaultPage = lazy(() => import('../../pages/vault'));
export const VaultAdminPage = lazy(() => import('../../pages/vault-admin'));

// Wrapper components with Suspense and ErrorBoundary
export const LazyTradePage = () => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingPage />}>
      <TradePage />
    </Suspense>
  </ErrorBoundary>
);

export const LazyVaultPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingPage />}>
      <VaultPage />
    </Suspense>
  </ErrorBoundary>
);

export const LazyVaultAdminPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingPage />}>
      <VaultAdminPage />
    </Suspense>
  </ErrorBoundary>
);
