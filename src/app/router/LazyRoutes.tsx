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
export const LeaderboardPage = lazy(() => import('@/pages/leaderboard'));

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

export const LazyLeaderboardPage = () => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingPage />}>
      <LeaderboardPage />
      <HideBootSplash />
    </Suspense>
  </ErrorBoundary>
);
