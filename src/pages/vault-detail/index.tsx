/**
 * Single vault page, addressed by vault id in the URL.
 */
import { useParams } from 'react-router-dom';

import { VaultDetail } from '@/features/vaults';

function VaultDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="flex min-h-[calc(100vh-60px)] flex-col px-2 py-6 md:px-4 md:py-8">
      <div className="mx-auto w-full max-w-7xl">
        <VaultDetail id={id} />
      </div>
    </div>
  );
}

export default VaultDetailPage;
