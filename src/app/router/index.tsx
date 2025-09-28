/**
 * AppRouter.tsx
 * Main application router configuration with code splitting
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/shared/ui/layout/Layout';
import { LazyTradePage, LazyPerpsPage, LazyVaultPage } from './LazyRoutes';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate replace to="/spot" />} />

          <Route path="/spot" element={<LazyTradePage />} />
          <Route path="/spot/:id" element={<LazyTradePage />} />
          <Route path="/perps" element={<LazyPerpsPage />} />
          <Route path="/perps/:id" element={<LazyPerpsPage />} />
          <Route path="/vault" element={<LazyVaultPage />} />
          <Route path="*" element={<Navigate replace to="/perps" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
