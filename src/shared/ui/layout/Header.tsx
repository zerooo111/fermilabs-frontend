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
    return { label: 'Mainnet', className: 'text-green-400 bg-green-500/15 border-green-500/30' };
  if (rpcUrl.includes('devnet'))
    return { label: 'Devnet', className: 'text-amber-400 bg-amber-500/15 border-amber-500/30' };
  if (rpcUrl.includes('testnet'))
    return { label: 'Testnet', className: 'text-blue-400 bg-blue-500/15 border-blue-500/30' };
  return { label: 'Custom', className: 'text-zinc-400 bg-zinc-500/15 border-zinc-500/30' };
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
    <nav className="w-full h-14 flex items-center p-3 border-b border-outline bg-background">
      <div className="flex items-center justify-between flex-1">
        <div className="flex items-center gap-3 relative">
          <Link
            to="/"
            className="flex font-semibold items-center px-2 py-1 gap-2 text-lg text-primary"
          >
            <FermiLogo3d className="w-6 h-6 " />
            Fermi Trade
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-amber-400/15 text-amber-300 border border-amber-400/30 leading-none">
              Beta
            </span>
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
