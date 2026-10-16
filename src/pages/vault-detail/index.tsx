/**
 * Single vault page, addressed by network and vault address in the URL
 * (`/vaults/devnet/<address>`), so devnet and mainnet links never collide.
 */
import { Navigate, useParams } from 'react-router-dom';

import { VaultDetail } from '@/features/vaults';

function VaultDetailPage() {
  const { network, address } = useParams<{ network: string; address: string }>();
  if ((network !== 'devnet' && network !== 'mainnet') || !address) {
    return <Navigate to="/vaults" replace />;
  }
  return (
    <div className="flex min-h-[calc(100vh-60px)] flex-col px-3 py-6 md:px-6 md:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <VaultDetail key={`${network}:${address}`} network={network} address={address} />
      </div>
    </div>
  );
}

export default VaultDetailPage;
