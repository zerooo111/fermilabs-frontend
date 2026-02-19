/**
 * LazyRoutes.tsx
 * Defines lazy-loaded route components for code splitting
 */
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import NoiseOverlay from '@/pages/home/ui/NoiseOverlay';

// Loading component for Suspense fallback
const LoadingPage = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-dark-forest text-rock font-[Arimo]">
    <img src="/logo.svg" alt="Fermi" className="w-12 h-12 mb-4 animate-pulse" />
    <span className="text-3xl font-display tracking-wide">Fermi Trade</span>
    <NoiseOverlay />
  </div>
);

export const HomePage = lazy(() => import('@/pages/home'));
export const TradePage = lazy(() => import('@/pages/trade'));
export const PerpsPage = lazy(() => import('@/pages/perps'));
export const VaultPage = lazy(() => import('@/pages/vault'));

// Wrapper components with Suspense and ErrorBoundary
export const LazyHomePage = () => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingPage />}>
      <HomePage />
    </Suspense>
  </ErrorBoundary>
);

export const LazyTradePage = () => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingPage />}>
      <TradePage />
    </Suspense>
  </ErrorBoundary>
);

export const LazyPerpsPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingPage />}>
      <PerpsPage />
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
