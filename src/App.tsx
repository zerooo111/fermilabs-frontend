/**
 * App.tsx
 * Main application component with wallet context integration
 */

import { WalletContextProvider } from './contexts/WalletContext';
import { ConnectWallet } from './components/ConnectWallet';
import { WalletDetails } from './components/WalletDetails';
import { useAtomValue } from 'jotai';
import { marketAddressAtom } from './atoms/market';
import { JotaiDevTools } from './components/JotaiDevTools';

function App() {
  const marketAddress = useAtomValue(marketAddressAtom);

  return (
    <WalletContextProvider>
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <nav className="flex justify-between items-center mb-8">
          <WalletDetails />
          <ConnectWallet />
        </nav>
        <main>
          <h1 className="text-3xl font-bold">Fermi Labs DEX</h1>
          <div className="mt-4 text-gray-400">
            Market: <span className="font-mono">{marketAddress}</span>
          </div>
        </main>
        <JotaiDevTools />
      </div>
    </WalletContextProvider>
  );
}

export default App;
