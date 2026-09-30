/**
 * Vaults listing page. A thin frame around the `VaultsOverview` feature.
 */
import { VaultsOverview } from '@/features/vaults';

function VaultsPage() {
  return (
    <div className="flex min-h-[calc(100vh-60px)] flex-col px-2 py-6 md:px-4 md:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <VaultsOverview />
      </div>
    </div>
  );
}

export default VaultsPage;
