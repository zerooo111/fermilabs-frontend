/**
 * App.tsx
 * Main application component with wallet context integration
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { VaultAdminPage } from './components/vault/VaultAdminPage';
import TradePage from './components/trade/TradePage';
import VaultPage from './components/vault/VaultPage';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate replace to="/trade" />} />
          <Route path="/vault-admin" element={<VaultAdminPage />} />
          <Route path="/trade" element={<TradePage />} />
          <Route path="/vault" element={<VaultPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
