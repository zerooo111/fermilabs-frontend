/**
 * AppRouter.tsx
 * Main application router configuration with code splitting
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/shared/ui/layout/Layout';
import { LazyHomePage, LazyPerpsPage, LazyVaultPage, LazyReferralsPage } from './LazyRoutes';
import { REFERRALS_ENABLED } from '@/shared/config/constants';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LazyHomePage />} />

        <Route element={<Layout />}>
          <Route path="/perps" element={<LazyPerpsPage />} />
          <Route path="/perps/:id" element={<LazyPerpsPage />} />
          <Route path="/vault" element={<LazyVaultPage />} />
          {/* Referral programme — behind the `fermi.referralsEnabled` flag.
              When off, /referrals falls through to the catch-all → /perps. */}
          {REFERRALS_ENABLED && <Route path="/referrals" element={<LazyReferralsPage />} />}
          <Route path="*" element={<Navigate replace to="/perps" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
