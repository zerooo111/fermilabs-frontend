import { Link, useLocation } from 'react-router-dom';
import Setting from '../Setting';
import { ConnectWallet } from './ConnectWallet';
import { cn } from '@/utils/cn';

const Header = () => {
  const location = useLocation();
  return (
    <nav className="w-full  flex items-center p-3">
      <div className="flex items-center justify-between flex-1">
        <div className="flex items-center gap-3 relative">
          <Link to="/" className="text-lg">
            <span className="font-bold">Fermi</span>
            <span className="font-regular">Labs</span>
          </Link>
          <Link
            to="/trade"
            className={cn(
              'duration-100 ease-out relative group  text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 px-2 py-1',
              location.pathname === '/trade' && 'text-zinc-900 bg-zinc-100'
            )}
          >
            Trade
          </Link>

          <Link
            to="/vault"
            className={cn(
              'duration-100 ease-out relative group  text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 px-2 py-1',
              location.pathname === '/vault' && 'text-zinc-900 bg-zinc-100'
            )}
          >
            Vaults
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          <Setting />
          {/* <AirdropPopover /> */}
          <ConnectWallet />
        </div>
      </div>
    </nav>
  );
};

export default Header;
