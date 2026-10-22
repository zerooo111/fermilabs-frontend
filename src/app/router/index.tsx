/**
 * AppRouter.tsx
 * Main application router configuration with code splitting
 */
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { Layout } from '@/shared/ui/layout/Layout';
import {
  LazyHomePage,
  LazyPerpsPage,
  LazyVaultPage,
  LazyReferralsPage,
  LazyFlpPage,
  LazyVaultsPage,
  LazyVaultDetailPage,
  LazyPointsPage,
  LazyPointsDocsPage,
  LazyPointsDashboardPage,
} from './LazyRoutes';
import { isAppHost, redirectOffLanding } from './domains';
import { showUnlaunched } from '@/shared/lib/domains';
import { GateScopeSync, gateScopeOf } from '@/features/access-gate';
import { AnnouncementBar } from '@/features/points/ui/AnnouncementBar';
// The format module, not the feature index: keeps the points UI out of the main bundle.
import { walletPointsPath } from '@/features/points/model/format';

/** Old /points/<address> links, from before the wallet moved to ?wallet=. */
const LegacyWalletRedirect = () => {
  const { wallet = '' } = useParams();
  return <Navigate replace to={walletPointsPath(wallet)} />;
};

/** The ALIEN points announcement, on every page but the points pages. */
const Announcement = () => {
  const { pathname } = useLocation();
  return gateScopeOf(pathname) !== 'points' ? <AnnouncementBar /> : null;
};

export const AppRouter = () => {
  // fermi.trade is landing-only; app routes there go to app.fermi.trade
  if (redirectOffLanding()) return null;

  return (
    <BrowserRouter>
      <GateScopeSync />
      <Announcement />
      <Routes>
        {/* app.fermi.trade has no landing page */}
        <Route path="/" element={isAppHost ? <Navigate replace to="/perps" /> : <LazyHomePage />} />

        {/* Served on fermi.trade with the landing chrome */}
        <Route path="/points" element={<LazyPointsPage />} />
        <Route path="/points/docs" element={<LazyPointsDocsPage />} />
        <Route path="/points/:wallet" element={<LegacyWalletRedirect />} />
        {/* Share links are answered by a Pages Function (functions/s); if one ever reaches the app, it goes to the points page. */}
        <Route path="/s/:token" element={<Navigate replace to="/points" />} />

        <Route element={<Layout />}>
          <Route path="/perps" element={<LazyPerpsPage />} />
          <Route path="/perps/:id" element={<LazyPerpsPage />} />
          <Route path="/vault" element={<LazyVaultPage />} />
          <Route path="/referrals" element={<LazyReferralsPage />} />
          <Route path="/dashboard/points" element={<LazyPointsDashboardPage />} />
          {showUnlaunched && (
            <>
              <Route path="/flp" element={<LazyFlpPage />} />
              <Route path="/vaults" element={<LazyVaultsPage />} />
              <Route path="/vaults/:network/:address" element={<LazyVaultDetailPage />} />
            </>
          )}
          <Route path="*" element={<Navigate replace to="/perps" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
