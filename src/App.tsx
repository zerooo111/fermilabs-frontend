/**
 * App.tsx
 * Main application component with wallet context integration
 */
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { VaultPage } from './components/vault/VaultPage';
import { HomePage } from './components/home/HomePage';
import { Layout } from './components/layout/Layout';

const App = () => {
  const TradePage = () => {
    return <div>This is a trade page</div>;
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/trade" element={<TradePage />} />
          <Route path="/vault" element={<VaultPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
