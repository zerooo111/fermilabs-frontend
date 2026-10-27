/**
 * One line under the vault's header before launch: while public intake is
 * paused in pre-deposit, only approved wallets can deposit (they get FLP at
 * once). Read from the lifecycle and the wallet's approval, never assumed
 * (INTEGRATION_GUIDE.md "Mainnet user flows now").
 */
import { PublicKey } from '@solana/web3.js';

import { useFlpVault } from '../model/useFlpVault';

export function LaunchStrip({ vault }: { vault: PublicKey }) {
  const { envelope, user, owner } = useFlpVault(vault);
  const l = envelope?.data.lifecycle;
  if (!l || l.mode !== 'pre-deposit' || !l.publicDepositsPaused) return null;

  const wallet = !owner
    ? null
    : user?.depositApproved
      ? 'Your wallet is approved: deposits mint FLP at once.'
      : user !== undefined
        ? 'This wallet isn’t approved.'
        : null;

  return (
    <p className="border border-outline bg-card px-4 py-2.5 text-xs text-rock/70">
      <span className="text-rock">Public pre-deposits are paused.</span> Only whitelisted wallets
      can deposit right now.{wallet && ` ${wallet}`}
    </p>
  );
}
