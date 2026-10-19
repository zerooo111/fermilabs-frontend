/**
 * AppRouter.tsx
 * Main application router configuration with code splitting
 */
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
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
  LazyPointsWalletPage,
} from './LazyRoutes';
import { isAppHost, redirectOffLanding } from './domains';
// The format module, not the feature index: keeps the points UI out of the main bundle.
import { walletPointsPath } from '@/features/points/model/format';

/** /points is the checker; /points?wallet=<address> is that wallet's dashboard. */
const PointsRoute = () => {
  const [params] = useSearchParams();
  return params.has('wallet') ? <LazyPointsWalletPage /> : <LazyPointsPage />;
};

/** Old /points/<address> links, from before the wallet moved to ?wallet=. */
const LegacyWalletRedirect = () => {
  const { wallet = '' } = useParams();
  return <Navigate replace to={walletPointsPath(wallet)} />;
};

export const AppRouter = () => {
  // fermi.trade is landing-only; app routes there go to app.fermi.trade
  if (redirectOffLanding()) return null;

  return (
    <BrowserRouter>
      <Routes>
        {/* app.fermi.trade has no landing page */}
        <Route path="/" element={isAppHost ? <Navigate replace to="/perps" /> : <LazyHomePage />} />

        {/* Served on fermi.trade with the landing chrome */}
        <Route path="/points" element={<PointsRoute />} />
        <Route path="/points/docs" element={<LazyPointsDocsPage />} />
        <Route path="/points/:wallet" element={<LegacyWalletRedirect />} />

        <Route element={<Layout />}>
          <Route path="/perps" element={<LazyPerpsPage />} />
          <Route path="/perps/:id" element={<LazyPerpsPage />} />
          <Route path="/vault" element={<LazyVaultPage />} />
          <Route path="/referrals" element={<LazyReferralsPage />} />
          <Route path="/flp" element={<LazyFlpPage />} />
          <Route path="/vaults" element={<LazyVaultsPage />} />
          <Route path="/vaults/:network/:address" element={<LazyVaultDetailPage />} />
          <Route path="*" element={<Navigate replace to="/perps" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
