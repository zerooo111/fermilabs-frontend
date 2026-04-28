import { Link, useLocation } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue } from 'jotai';
import { cn } from '@/lib/utils';
import { ConnectWallet } from '../../../features/wallet-connect/ui/ConnectWallet';
import { FeeCreditDialog } from '@/features/fee-credit';
import { MarginPanel } from '@/features/margin-panel/ui/MarginPanel';
import { accessSessionAtom } from '@/features/access-gate';
import FermiLogo3d from './FermiLogo';

export function Header() {
  const location = useLocation();
  const { publicKey } = useWallet();
  const session = useAtomValue(accessSessionAtom);

  const walletKey = publicKey?.toBase58();
  const hasSession = !!(
    walletKey &&
    session[walletKey]?.token &&
    session[walletKey].expiresAt - 5 * 60 > Math.floor(Date.now() / 1000)
  );

  return (
    <nav className="w-full h-14 flex items-center p-3 border-b border-outline bg-background">
      <div className="flex items-center justify-between flex-1">
        <div className="flex items-center gap-3 relative">
          <Link
            to="/"
            className="flex font-semibold items-center px-2 py-1 gap-2 text-lg text-primary"
          >
            <FermiLogo3d className="w-6 h-6 " />
            Fermi Trade
          </Link>
          <Link
            to="/perps"
            className={cn(
              'duration-100 ease-out relative text-white/50 hover:text-white  group px-2 py-1',
              location.pathname === '/perps' && 'text-white'
            )}
          >
            Perps
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          {hasSession && (
            <>
              <MarginPanel />
              <FeeCreditDialog />
              <ConnectWallet />
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
