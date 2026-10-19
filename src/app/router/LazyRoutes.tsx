/**
 * LazyRoutes.tsx
 * Defines lazy-loaded route components with skeleton loading states
 */
import { lazy, Suspense, useEffect } from 'react';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { TradingSkeleton } from '@/shared/ui/TradingSkeleton';
import { hideBootSplash } from '@/shared/lib/boot-splash';

// The boot splash (index.html) covers the first load until a route renders.
// These fallbacks only show on later client-side navigations.
const LoadingPage = () => <div className="min-h-screen bg-dark-forest" />;

// Rendered beside each page inside its Suspense boundary, so it mounts only
// once the page's chunk has loaded and the page itself has rendered.
const HideBootSplash = () => {
  useEffect(hideBootSplash, []);
  return null;
};

export const HomePage = lazy(() => import('@/pages/home'));
export const PerpsPage = lazy(() => import('@/pages/perps'));
export const VaultPage = lazy(() => import('@/pages/vault'));
export const ReferralsPage = lazy(() => import('@/pages/referrals'));
export const FlpPage = lazy(() => import('@/pages/flp'));
export const VaultsPage = lazy(() => import('@/pages/vaults'));
export const VaultDetailPage = lazy(() => import('@/pages/vault-detail'));
export const PointsPage = lazy(() => import('@/pages/points'));
export const PointsDocsPage = lazy(() => import('@/pages/points/docs'));
export const PointsWalletPage = lazy(() => import('@/pages/points/wallet'));

// Wrapper components with Suspense and ErrorBoundary
export const LazyHomePage = () => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingPage />}>
      <HomePage />
      <HideBootSplash />
    </Suspense>
  </ErrorBoundary>
);

export const LazyPerpsPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<TradingSkeleton />}>
      <PerpsPage />
      <HideBootSplash />
    </Suspense>
  </ErrorBoundary>
);

export const LazyVaultPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<TradingSkeleton />}>
      <VaultPage />
      <HideBootSplash />
    </Suspense>
  </ErrorBoundary>
);

export const LazyReferralsPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<TradingSkeleton />}>
      <ReferralsPage />
      <HideBootSplash />
    </Suspense>
  </ErrorBoundary>
);

export const LazyFlpPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingPage />}>
      <FlpPage />
      <HideBootSplash />
    </Suspense>
  </ErrorBoundary>
);

export const LazyVaultsPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<TradingSkeleton />}>
      <VaultsPage />
      <HideBootSplash />
    </Suspense>
  </ErrorBoundary>
);

export const LazyVaultDetailPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<TradingSkeleton />}>
      <VaultDetailPage />
      <HideBootSplash />
    </Suspense>
  </ErrorBoundary>
);

export const LazyPointsPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingPage />}>
      <PointsPage />
      <HideBootSplash />
    </Suspense>
  </ErrorBoundary>
);

export const LazyPointsDocsPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingPage />}>
      <PointsDocsPage />
      <HideBootSplash />
    </Suspense>
  </ErrorBoundary>
);

export const LazyPointsWalletPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingPage />}>
      <PointsWalletPage />
      <HideBootSplash />
    </Suspense>
  </ErrorBoundary>
);
