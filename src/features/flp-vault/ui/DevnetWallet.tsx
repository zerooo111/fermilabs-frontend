/**
 * The vault pages' own wallet connection, without Privy. FLP runs on devnet,
 * and Privy is configured for the app's mainnet trading, so testers connect a
 * wallet extension directly (Phantom, Solflare, Backpack… in devnet/testnet
 * mode). Inside `FlpWalletProvider`, `useWallet()` is this connection; the
 * header's Privy login is untouched and unrelated.
 *
 * Transactions are signed with the wallet's sign-only feature, which carries
 * no chain: the wallet uses its own network setting.
 *
 * TODO(remove): this separate wallet handling is temporary, for devnet
 * testing only. When FLP moves to mainnet, delete this file and the
 * FlpWalletProvider wrappers in pages/vaults and pages/vault-detail, so the
 * vault pages use the app's Privy wallet like the rest of the app.
 */
import { useState, type ReactNode } from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletReadyState, type Adapter } from '@solana/wallet-adapter-base';
import { ExternalLink, LogOut } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

import { FLP_RPC_URL } from '../model/config';

// Wallet-standard wallets (Phantom, Solflare, Backpack, …) are detected by
// WalletProvider itself; no adapters to list.
const NO_ADAPTERS: Adapter[] = [];

export function FlpWalletProvider({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={FLP_RPC_URL}>
      <WalletProvider
        wallets={NO_ADAPTERS}
        // Separate from the app's Privy selection.
        localStorageKey="fermi.flpDevnetWallet"
        autoConnect
        onError={error => {
          if (/reject|denied|cancel/i.test(error.message)) return;
          toast.error(error.message || error.name || 'Wallet error');
        }}
      >
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

/** Connect or disconnect the devnet wallet. */
export function DevnetWalletButton({ size = 'sm' }: { size?: 'sm' | 'default' }) {
  const { wallets, wallet, publicKey, select, disconnect, connecting } = useWallet();
  const [open, setOpen] = useState(false);
  const installed = wallets.filter(
    w => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable
  );

  if (publicKey && wallet) {
    return (
      <Button variant="outline" size={size} className="gap-2" onClick={() => disconnect()}>
        <img src={wallet.adapter.icon} alt="" className="size-4" />
        <span className="font-mono text-xs">{short(publicKey.toBase58())}</span>
        <LogOut className="size-3.5" aria-label="Disconnect" />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size={size} disabled={connecting}>
          {connecting ? 'Connecting…' : 'Connect devnet wallet'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <p className="border-b border-outline px-3 py-2.5 text-xs text-rock/70">
          Connect a wallet extension directly. Switch it to devnet (testnet mode) first.
        </p>
        {installed.length ? (
          <ul className="flex flex-col py-1">
            {installed.map(w => (
              <li key={w.adapter.name}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-rock hover:bg-rock/5"
                  onClick={() => {
                    // autoConnect connects once the wallet is selected.
                    select(w.adapter.name);
                    setOpen(false);
                  }}
                >
                  <img src={w.adapter.icon} alt="" className="size-5" />
                  {w.adapter.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <a
            href="https://phantom.com/download"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-3 text-sm text-amber-200 hover:underline"
          >
            No wallet extension found. Get Phantom <ExternalLink className="size-3.5" />
          </a>
        )}
      </PopoverContent>
    </Popover>
  );
}
