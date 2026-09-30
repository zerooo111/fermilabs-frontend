/**
 * LazyRoutes.tsx
 * Defines lazy-loaded route components with skeleton loading states
 */
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { TradingSkeleton } from '@/shared/ui/TradingSkeleton';
import NoiseOverlay from '@/pages/home/ui/NoiseOverlay';

// Landing page loading — branded splash
const LoadingPage = () => (
  <div
    data-surface="brand"
    className="flex flex-col items-center justify-center min-h-screen bg-surface-brand text-fg-primary font-[Arimo]"
  >
    <img src="/logo.svg" alt="Fermi" className="w-12 h-12 mb-4 animate-pulse" />
    <span className="text-3xl font-display tracking-wide">Fermi Trade</span>
    <NoiseOverlay />
  </div>
);

export const HomePage = lazy(() => import('@/pages/home'));
export const PerpsPage = lazy(() => import('@/pages/perps'));
export const VaultPage = lazy(() => import('@/pages/vault'));
export const ReferralsPage = lazy(() => import('@/pages/referrals'));
export const VaultsPage = lazy(() => import('@/pages/vaults'));
export const VaultDetailPage = lazy(() => import('@/pages/vault-detail'));
export const DesignSystemPage = lazy(() => import('@/pages/design-system'));

// Wrapper components with Suspense and ErrorBoundary
export const LazyHomePage = () => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingPage />}>
      <HomePage />
    </Suspense>
  </ErrorBoundary>
);

export const LazyPerpsPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<TradingSkeleton />}>
      <PerpsPage />
    </Suspense>
  </ErrorBoundary>
);

export const LazyVaultPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<TradingSkeleton />}>
      <VaultPage />
    </Suspense>
  </ErrorBoundary>
);

export const LazyReferralsPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<TradingSkeleton />}>
      <ReferralsPage />
    </Suspense>
  </ErrorBoundary>
);

export const LazyVaultsPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<TradingSkeleton />}>
      <VaultsPage />
    </Suspense>
  </ErrorBoundary>
);

export const LazyVaultDetailPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<TradingSkeleton />}>
      <VaultDetailPage />
    </Suspense>
  </ErrorBoundary>
);

export const LazyDesignSystemPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<TradingSkeleton />}>
      <DesignSystemPage />
    </Suspense>
  </ErrorBoundary>
);
