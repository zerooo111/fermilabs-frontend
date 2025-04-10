/**
 * AppRouter.tsx
 * Main application router configuration with code splitting
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/shared/ui/layout/Layout';
import { LazyTradePage, LazyVaultPage, LazyVaultAdminPage } from './LazyRoutes';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate replace to="/trade" />} />

          <Route path="/vault-admin" element={<LazyVaultAdminPage />} />
          <Route path="/trade" element={<LazyTradePage />} />
          <Route path="/trade/:id" element={<LazyTradePage />} />
          <Route path="/vault" element={<LazyVaultPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
