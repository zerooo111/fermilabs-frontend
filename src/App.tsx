/**
 * App.tsx
 * Main application component with wallet context integration
 */

import { WalletContextProvider } from './contexts/WalletContext';
import { ConnectWallet } from './components/ConnectWallet';
import { WalletDetails } from './components/WalletDetails';

function App() {
  return (
    <WalletContextProvider>
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <nav className="flex justify-between items-center mb-8">
          <WalletDetails />
          <ConnectWallet />
        </nav>
        <main>
          <h1 className="text-3xl font-bold">Fermi Labs DEX</h1>
        </main>
      </div>
    </WalletContextProvider>
  );
}

export default App;
