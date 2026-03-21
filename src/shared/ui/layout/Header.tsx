import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ConnectWallet } from '../../../features/wallet-connect/ui/ConnectWallet';
import FermiLogo3d from './FermiLogo';

export function Header() {
  const location = useLocation();
  return (
    <nav className="w-full h-14  flex items-center p-3 border-b border-outline">
      <div className="flex items-center justify-between flex-1">
        <div className="flex items-center gap-3 relative">
          <Link
            to="/"
            className="flex font-semibold items-center px-2 py-1 gap-2 text-lg text-primary"
          >
            <FermiLogo3d className="w-6 h-6 " />
            Fermi Trade
          </Link>
          {/* <Link
            to="/spot"
            className={cn(
              'duration-100 ease-out relative text-white/50 hover:text-white  group px-2 py-1',
              location.pathname === '/spot' && 'text-white'
            )}
          >
            Spot
          </Link> */}
          <Link
            to="/perps"
            className={cn(
              'duration-100 ease-out relative text-white/50 hover:text-white  group px-2 py-1',
              location.pathname === '/perps' && 'text-white'
            )}
          >
            Perps
          </Link>

          <Link
            to="/vault"
            className={cn(
              'duration-100 ease-out relative text-white/50 hover:text-white  group px-2 py-1',
              location.pathname === '/vault' && 'text-white'
            )}
          >
            Vaults
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          {/* <ServerSelector /> */}
          <ConnectWallet />
        </div>
      </div>
    </nav>
  );
}
