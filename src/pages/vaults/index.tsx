/**
 * Vaults listing page. A thin frame around the `VaultsOverview` feature.
 * The FLP vaults are on devnet: their wallet is a direct connection
 * (FlpWalletProvider), not the app's Privy login.
 */
import { FlpWalletProvider } from '@/features/flp-vault';
import { VaultsOverview } from '@/features/vaults';

function VaultsPage() {
  return (
    <div className="flex min-h-[calc(100vh-60px)] flex-col px-3 py-6 md:px-6 md:py-10">
      <div className="mx-auto w-full max-w-7xl">
        {/* TODO(remove): temporary devnet wallet for FLP testing; drop on mainnet (see DevnetWallet.tsx). */}
        <FlpWalletProvider>
          <VaultsOverview />
        </FlpWalletProvider>
      </div>
    </div>
  );
}

export default VaultsPage;
