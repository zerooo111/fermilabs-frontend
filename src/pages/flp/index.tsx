/**
 * `/flp` is a short link to the FLP vault's page under /vaults.
 */
import { Navigate } from 'react-router-dom';

import { FLP_VAULTS } from '@/features/flp-vault';

function FlpPage() {
  return <Navigate to={`/vaults/devnet/${FLP_VAULTS[0].address.toBase58()}`} replace />;
}

export default FlpPage;
