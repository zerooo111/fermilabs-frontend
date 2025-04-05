/**
 * AppRouter.tsx
 * Main application router configuration
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '../../shared/ui/layout/Layout';
import { TradePage } from '../../pages/trade';
import { VaultPage } from '../../pages/vault';
import { VaultAdminPage } from '../../pages/vault-admin';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate replace to="/trade" />} />
          <Route path="/vault-admin" element={<VaultAdminPage />} />
          <Route path="/trade" element={<TradePage />} />
          <Route path="/trade/:id" element={<TradePage />} />
          <Route path="/vault" element={<VaultPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
