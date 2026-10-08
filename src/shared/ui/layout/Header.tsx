import { Link, useLocation } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue } from 'jotai';
import { cn } from '@/lib/utils';
import { ConnectWallet } from '../../../features/wallet-connect/ui/ConnectWallet';
import { FeeCreditDialog } from '@/features/fee-credit';
import { ApiKeysPanel } from '@/features/api-keys';
import { MarginPanel } from '@/features/margin-panel/ui/MarginPanel';
import { accessSessionAtom } from '@/features/access-gate';
import FermiLogo3d from './FermiLogo';
import { LayoutMenu } from '@/features/layout';

const NAV_LINK = 'flex items-center px-2.5 text-sm transition-colors duration-150 hover:text-rock';

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
    <nav className="w-full h-14 flex items-stretch border-b border-outline bg-background text-rock">
      <div className="flex items-stretch justify-between flex-1 px-2 md:px-4">
        <div className="flex items-stretch gap-1">
          <Link to="/" className="flex items-center gap-2.5 pr-5 text-lg hover:text-amber-100">
            <FermiLogo3d className="w-6 h-6" />
            Fermi Trade
            <span className="border border-amber-200/60 px-1 text-[9px] font-semibold tracking-wider text-amber-200 leading-[14px]">
              BETA
            </span>
          </Link>
          <Link
            to="/perps"
            className={cn(
              NAV_LINK,
              location.pathname.startsWith('/perps') ? 'text-rock' : 'text-rock/60'
            )}
          >
            Perps
          </Link>
          <Link
            to="/referrals"
            className={cn(
              NAV_LINK,
              location.pathname === '/referrals' ? 'text-rock' : 'text-rock/60'
            )}
          >
            Referrals
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          <LayoutMenu />
          {hasSession && (
            <>
              <MarginPanel />
              <FeeCreditDialog />
              <ApiKeysPanel />
            </>
          )}
          <ConnectWallet />
        </div>
      </div>
    </nav>
  );
}
