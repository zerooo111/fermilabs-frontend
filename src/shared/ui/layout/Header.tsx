import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ConnectWallet } from '../../../features/wallet-connect/ui/ConnectWallet';
import { ServerSelector } from '../../../features/server-selector/ui/ServerSelector';
import FermiLogo3d from './FermiLogo';

export function Header() {
  const location = useLocation();
  return (
    <nav className="w-full  flex items-center p-3">
      <div className="flex items-center justify-between flex-1">
        <div className="flex items-center gap-3 relative">
          <Link
            to="/"
            className="flex items-center glass-panel px-2 py-1 rounded-lg gap-2 text-2xl text-primary"
          >
            <FermiLogo3d className="w-8 h-8 " />
            <span className="font-bold">Fermi</span>
            <span className="font-regular">Labs</span>
          </Link>
          <Link
            to="/trade"
            className={cn(
              'duration-100 ease-out relative group rounded-xl  hover:glass-panel px-2 py-1',
              location.pathname === '/trade' && 'glass-panel '
            )}
          >
            Trade
          </Link>

          <Link
            to="/vault"
            className={cn(
              'duration-100 ease-out relative group rounded-xl hover:glass-panel px-2 py-1',
              location.pathname === '/vault' && 'glass-panel '
            )}
          >
            Vaults
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          <ServerSelector />
          <ConnectWallet />
        </div>
      </div>
    </nav>
  );
}
