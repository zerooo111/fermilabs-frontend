import { Link, useLocation } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue } from 'jotai';
import { cn } from '@/lib/utils';
import { landingHref, showUnlaunched } from '@/shared/lib/domains';
import { ConnectWallet } from '../../../features/wallet-connect/ui/ConnectWallet';
import { FeeCreditDialog } from '@/features/fee-credit';
import { ApiKeysMenuItem, ApiKeysPanel } from '@/features/api-keys';
import { PointsChip, PointsIcon, walletPointsPath } from '@/features/points';
import { MarginPanel } from '@/features/margin-panel/ui/MarginPanel';
import { accessSessionAtom } from '@/features/access-gate';
import FermiLogo3d from './FermiLogo';
import { LayoutMenu } from '@/features/layout';

const NAV_LINK =
  'flex shrink-0 items-center px-2.5 text-sm transition-colors duration-150 hover:text-rock';

/**
 * The public points page, opened on the connected wallet's results when there
 * is one. It's a landing route, so on app.fermi.trade it leaves for fermi.trade.
 */
function AlienLink({ walletKey }: { walletKey: string | undefined }) {
  const location = useLocation();
  const href = landingHref(walletKey ? walletPointsPath(walletKey) : '/points');
  const className = cn(
    NAV_LINK,
    'gap-1.5',
    location.pathname === '/points' ? 'text-rock' : 'text-rock/60',
    walletKey && 'md:hidden'
  );
  const content = (
    <>
      <PointsIcon className="size-3.5 text-primary" />
      ALIEN
    </>
  );
  return href.startsWith('http') ? (
    <a href={href} className={className}>
      {content}
    </a>
  ) : (
    <Link to={href} className={className}>
      {content}
    </Link>
  );
}

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
      <div className="flex min-w-0 items-stretch justify-between flex-1 px-2 md:px-4">
        {/* Nav scrolls within itself on narrow screens rather than widening the page. */}
        <div className="flex min-w-0 items-stretch gap-1 overflow-x-auto [scrollbar-width:none]">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2.5 pr-5 text-lg hover:text-amber-100"
          >
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
          {showUnlaunched && (
            <Link
              to="/vaults"
              className={cn(
                NAV_LINK,
                location.pathname.startsWith('/vaults') ? 'text-rock' : 'text-rock/60'
              )}
            >
              Vaults
            </Link>
          )}
          <Link
            to="/referrals"
            className={cn(
              NAV_LINK,
              location.pathname === '/referrals' ? 'text-rock' : 'text-rock/60'
            )}
          >
            Referrals
          </Link>
          {/* A connected wallet gets the points chip on the right instead; it's
              hidden below md, so the link stays there. */}
          <AlienLink walletKey={walletKey} />
        </div>
        {/* Most-glanced first: balances, points, then the account. Fee credit and
            API keys live inside the balances and account menus; their dialogs
            stay mounted here so those menus and the order form can open them. */}
        <div className="flex shrink-0 items-center gap-1.5">
          <LayoutMenu />
          {hasSession && (
            <>
              {/* Margin only matters while trading. */}
              {location.pathname.startsWith('/perps') && <MarginPanel />}
              <FeeCreditDialog />
              <ApiKeysPanel />
            </>
          )}
          <PointsChip className="hidden md:inline-flex" />
          <ConnectWallet menuItems={hasSession && <ApiKeysMenuItem />} />
        </div>
      </div>
    </nav>
  );
}
