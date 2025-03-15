import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { WalletContextProvider } from './contexts/WalletContext';
import { QueryProvider } from './contexts/QueryProvider';
import { ToastProvider } from './components/ToastProvider.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <WalletContextProvider>
        <App />
        <ToastProvider />
      </WalletContextProvider>
    </QueryProvider>
  </StrictMode>
);
