/**
 * AppRouter.tsx
 * Main application router configuration with code splitting
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/shared/ui/layout/Layout';
import {
  LazyHomePage,
  LazyPerpsPage,
  LazyVaultPage,
  LazyReferralsPage,
  LazyVaultsPage,
  LazyVaultDetailPage,
  LazyDesignSystemPage,
} from './LazyRoutes';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LazyHomePage />} />

        <Route element={<Layout />}>
          <Route path="/perps" element={<LazyPerpsPage />} />
          <Route path="/perps/:id" element={<LazyPerpsPage />} />
          <Route path="/vault" element={<LazyVaultPage />} />
          <Route path="/vaults" element={<LazyVaultsPage />} />
          <Route path="/vaults/:id" element={<LazyVaultDetailPage />} />
          <Route path="/referrals" element={<LazyReferralsPage />} />
          <Route path="/design-system" element={<LazyDesignSystemPage />} />
          <Route path="*" element={<Navigate replace to="/perps" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
