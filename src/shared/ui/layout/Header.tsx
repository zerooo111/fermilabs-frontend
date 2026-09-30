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
import { config } from '@/shared/config/constants';

function getNetwork(rpcUrl: string): { label: string; className: string } {
  if (rpcUrl.includes('mainnet'))
    return {
      label: 'Mainnet',
      className: 'text-positive-fg bg-positive-muted border-positive-line',
    };
  if (rpcUrl.includes('devnet'))
    return { label: 'Devnet', className: 'text-warning-fg bg-warning-muted border-warning-line' };
  if (rpcUrl.includes('testnet'))
    return { label: 'Testnet', className: 'text-info-fg bg-info-muted border-info-line' };
  return { label: 'Custom', className: 'text-fg-secondary bg-surface-raised border-line' };
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

  const network = getNetwork(config.devnet.rpcUrl);

  return (
    <nav className="w-full h-14 flex items-center p-3 border-b border-line bg-surface-canvas">
      <div className="flex items-center justify-between flex-1">
        <div className="flex items-center gap-3 relative">
          <Link
            to="/"
            className="flex font-semibold items-center px-2 py-1 gap-2 text-lg text-fg-primary"
          >
            <FermiLogo3d className="w-6 h-6 " />
            Fermi Trade
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-warning-muted text-warning-fg border border-warning-line leading-none">
              Beta
            </span>
          </Link>
          <Link
            to="/perps"
            className={cn(
              'duration-100 ease-out relative text-fg-tertiary hover:text-fg-primary group px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-line-focus',
              location.pathname === '/perps' && 'text-fg-primary'
            )}
          >
            Perps
          </Link>
          <Link
            to="/vaults"
            className={cn(
              'duration-100 ease-out relative text-fg-tertiary hover:text-fg-primary group px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-line-focus',
              location.pathname.startsWith('/vaults') && 'text-fg-primary'
            )}
          >
            Vaults
          </Link>
          <Link
            to="/referrals"
            className={cn(
              'duration-100 ease-out relative text-fg-tertiary hover:text-fg-primary group px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-line-focus',
              location.pathname === '/referrals' && 'text-fg-primary'
            )}
          >
            Referrals
          </Link>
          <span
            className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', network.className)}
          >
            {network.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
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
