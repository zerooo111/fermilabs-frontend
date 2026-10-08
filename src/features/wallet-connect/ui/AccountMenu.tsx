/**
 * AccountMenu.tsx
 * Dropdown content for the connected account: who is logged in (email, Google,
 * X, or an external wallet), the trading wallet behind it, and account actions.
 */
import { useState } from 'react';
import { Check, Copy, ExternalLink, KeyRound, LogOut, Repeat } from 'lucide-react';
import { EnvelopeSimple, GoogleLogo, Wallet, XLogo } from '@phosphor-icons/react';
import { solscanAccountUrl, type AccountIdentity, type LoginMethod } from '@/entities/wallet';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/ui/dropdown-menu';
import { AccountAvatar } from './AccountAvatar';

// X's logo is its name, so its chip is the mark alone.
const METHOD_LABEL: Record<LoginMethod, string | null> = {
  email: 'Email',
  google: 'Google',
  twitter: null,
  wallet: 'Wallet',
};

const METHOD_ICON = {
  email: EnvelopeSimple,
  google: GoogleLogo,
  twitter: XLogo,
  wallet: Wallet,
} as const;

const EYEBROW = 'font-mono text-[10px] uppercase tracking-[0.15em] text-rock/55';
const CHIP =
  'inline-flex h-5 items-center gap-1 border border-rock/25 px-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-rock/75';

function MethodChip({ identity }: { identity: AccountIdentity }) {
  const Icon = METHOD_ICON[identity.method];
  const label = METHOD_LABEL[identity.method];
  return (
    <span className={CHIP} aria-label={label ?? 'X'}>
      {identity.walletIcon ? (
        <img src={identity.walletIcon} alt="" className="size-3" aria-hidden />
      ) : (
        <Icon weight="bold" className="size-3" aria-hidden />
      )}
      {label}
    </span>
  );
}

interface AccountMenuProps {
  address: string;
  identity: AccountIdentity | null;
  onExportWallet: () => void;
  onSwitchAccount: () => void;
  onLogOut: () => void;
}

export function AccountMenuContent({
  address,
  identity,
  onExportWallet,
  onSwitchAccount,
  onLogOut,
}: AccountMenuProps) {
  const [copied, setCopied] = useState(false);
  const isEmbedded = identity?.isEmbedded ?? false;

  const copyAddress = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <DropdownMenuContent align="end" sideOffset={6} className="w-72 p-0">
      {/* ── Identity ── */}
      <div className="flex items-center gap-3 p-3">
        <AccountAvatar
          address={address}
          avatarUrl={identity?.avatarUrl}
          className="size-10 border border-rock/15"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-medium text-rock" title={identity?.label}>
            {identity?.label ?? `${address.slice(0, 4)}…${address.slice(-4)}`}
          </span>
          {identity?.name && (
            <span className="-mt-1 truncate text-xs text-rock/60">{identity.name}</span>
          )}
          {identity && (
            <span>
              <MethodChip identity={identity} />
            </span>
          )}
        </div>
      </div>

      <DropdownMenuSeparator className="mx-0 my-0" />

      {/* ── Trading wallet ── */}
      <div className="flex flex-col gap-1 p-1 pt-2.5">
        <div className="flex items-center justify-between px-2">
          <span className={EYEBROW}>Trading wallet</span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-rock/60">
            <span
              className={isEmbedded ? 'size-1.5 bg-lichen' : 'size-1.5 border border-rock/60'}
            />
            {isEmbedded ? 'Embedded' : 'External'}
          </span>
        </div>
        <DropdownMenuItem
          // Stay open so the copy confirmation is visible.
          onSelect={event => {
            event.preventDefault();
            void copyAddress();
          }}
          className="justify-between font-mono text-xs"
          aria-label={copied ? 'Address copied' : 'Copy wallet address'}
        >
          <span className="truncate">
            {address.slice(0, 8)}…{address.slice(-8)}
          </span>
          {copied ? (
            <Check className="size-3.5 text-lichen" />
          ) : (
            <Copy className="size-3.5 text-rock/60" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="text-xs text-rock/75">
          <a href={solscanAccountUrl(address)} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5 text-rock/60" />
            View on Solscan
          </a>
        </DropdownMenuItem>
        {isEmbedded && (
          <DropdownMenuItem onSelect={onExportWallet} className="text-xs text-rock/75">
            <KeyRound className="size-3.5 text-rock/60" />
            Export private key
          </DropdownMenuItem>
        )}
      </div>

      <DropdownMenuSeparator className="mx-0 my-0" />

      {/* ── Session ── */}
      <div className="flex flex-col p-1">
        <DropdownMenuItem onSelect={onSwitchAccount} className="text-xs">
          <Repeat className="size-3.5" />
          Switch account
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onLogOut} className="text-xs text-danger">
          <LogOut className="size-3.5 text-danger" />
          Log out
        </DropdownMenuItem>
      </div>
    </DropdownMenuContent>
  );
}
