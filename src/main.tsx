import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { WalletContextProvider } from './contexts/WalletContext';
import { QueryProvider } from './contexts/QueryProvider';
import { ToastProvider } from './components/ToastProvider.tsx';
import FermiClientProvider from './components/FermiClientProvider.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <WalletContextProvider>
        <FermiClientProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </FermiClientProvider>
        <ToastProvider />
      </WalletContextProvider>
    </QueryProvider>
  </StrictMode>
);
