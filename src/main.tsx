import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { WalletContextProvider } from './contexts/WalletContext';
import { QueryProvider } from './contexts/QueryProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <WalletContextProvider>
        <App />
      </WalletContextProvider>
    </QueryProvider>
  </StrictMode>
);
