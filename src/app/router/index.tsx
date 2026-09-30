/**
 * AppRouter.tsx
 * Main application router configuration with code splitting
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/shared/ui/layout/Layout';
import {
  LazyHomePage,
  LazyPerpsPage,
  LazyPerpsV2Page,
  LazyVaultPage,
  LazyReferralsPage,
} from './LazyRoutes';
import { isAppHost, redirectOffLanding } from './domains';

export const AppRouter = () => {
  // fermi.trade is landing-only; app routes there go to app.fermi.trade
  if (redirectOffLanding()) return null;

  return (
    <BrowserRouter>
      <Routes>
        {/* app.fermi.trade has no landing page */}
        <Route path="/" element={isAppHost ? <Navigate replace to="/perps" /> : <LazyHomePage />} />

        <Route element={<Layout />}>
          <Route path="/perps" element={<LazyPerpsPage />} />
          <Route path="/perps/:id" element={<LazyPerpsPage />} />
          <Route path="/perps-v2" element={<LazyPerpsV2Page />} />
          <Route path="/perps-v2/:id" element={<LazyPerpsV2Page />} />
          <Route path="/vault" element={<LazyVaultPage />} />
          <Route path="/referrals" element={<LazyReferralsPage />} />
          <Route path="*" element={<Navigate replace to="/perps" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
