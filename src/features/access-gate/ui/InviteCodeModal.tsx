import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { WalletName } from '@solana/wallet-adapter-base';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Loader2, Wallet } from 'lucide-react';
import { Atom, Key, ArrowRight } from '@phosphor-icons/react';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import bs58 from 'bs58';

import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';

import { AccessGateError, redeemInvite, requestChallenge } from '../api/accessClient';
import { gateOpenAtom, gateLoadingAtom, accessSessionAtom } from '../model/accessAtoms';
import { writeSession } from '../lib/cache';
import { waitlistOpenAtom, waitlistSourceAtom } from '@/features/waitlist';
// Import the bind call directly from the client module (not the feature index)
// to avoid pulling `useReferrals` — which imports this feature's atoms — into
// the module graph here.
import { bindCode, ReferralsError } from '@/features/referrals/api/referralsClient';

const BETA_ACK_KEY = 'fermi.betaAck';

/** Friendly copy for referral-bind failures surfaced during invite redemption. */
const REFERRAL_ERROR_COPY: Record<string, string> = {
  invalid_code: "That referral code doesn't exist — skipped.",
  self_referral: "You can't refer yourself — referral skipped.",
  already_bound: 'This wallet already has a referrer — referral skipped.',
  already_trading: 'Referral codes must be applied before your first trade — skipped.',
};

/** Read an optional `?ref=` referral code from the current URL. */
function readRefFromUrl(): string {
  try {
    // Codes are case-insensitive, normalized to upper-case server-side.
    return new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase() ?? '';
  } catch {
    return '';
  }
}

function readBetaAck(): boolean {
  try {
    return localStorage.getItem(BETA_ACK_KEY) === '1';
  } catch {
    return false;
  }
}

function writeBetaAck(): void {
  try {
    localStorage.setItem(BETA_ACK_KEY, '1');
  } catch {
    // localStorage unavailable — ack lives only for this session.
  }
}

const ERROR_COPY: Record<string, string> = {
  invalid_code: "That code doesn't look right.",
  code_unknown: 'Code not found.',
  code_unavailable: 'This code has already been used or expired.',
  invalid_challenge: 'Sign-in expired. Please try again.',
  bad_signature: "Signature didn't match. Please try again.",
  wallet_already_whitelisted: 'This wallet already has access.',
  oversized_input: 'Invalid input.',
  invalid_wallet: 'Wallet not recognized.',
  rate_limited: 'Too many attempts. Please wait a moment.',
};

const BETA_ITEMS = [
  "We're shipping fast. Features, fees, and UX may change as we iterate.",
  'Short downtimes and occasional bugs are possible during beta.',
  'Your feedback shapes what we build next.',
  "By continuing, you confirm you're not a US person or located in a restricted jurisdiction.",
];

function HeaderIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex size-12 items-center justify-center border border-accent/30 bg-accent/10 text-accent">
      {children}
    </div>
  );
}

export function InviteCodeModal() {
  const {
    publicKey,
    signMessage,
    wallet,
    wallets,
    select,
    connect,
    connecting,
    connected,
    disconnect,
  } = useWallet();
  const [open, setOpen] = useAtom(gateOpenAtom);
  const gateLoading = useAtomValue(gateLoadingAtom);
  const [pendingWalletName, setPendingWalletName] = useState<WalletName | null>(null);
  const [, setSession] = useAtom(accessSessionAtom);
  const [code, setCode] = useState('');
  // Optional referral code, pre-filled from a `?ref=` share link. Applied
  // after a successful invite redemption (best-effort — see handleRedeem).
  const [referralCode, setReferralCode] = useState(() => readRefFromUrl());
  const [submitting, setSubmitting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(() => readBetaAck());
  const setWaitlistOpen = useSetAtom(waitlistOpenAtom);
  const setWaitlistSource = useSetAtom(waitlistSourceAtom);

  const handleAcknowledge = () => {
    writeBetaAck();
    setAcknowledged(true);
    posthog.capture('invite_beta_acknowledged');
  };

  const openWaitlist = () => {
    setWaitlistSource('invite-modal');
    setWaitlistOpen(true);
    posthog.capture('invite_waitlist_clicked');
  };

  // Dismissing the gate returns the user to view-only by disconnecting the
  // wallet; otherwise an authenticated-only header (margin/fee) would render
  // alongside a wallet that hasn't redeemed a session.
  const handleDismiss = () => {
    setOpen(false);
    setCode('');
    setPendingWalletName(null);
    if (publicKey) {
      disconnect().catch(err => {
        console.error('Wallet disconnect failed:', err);
      });
    }
  };

  // Dedupe wallets by adapter name (wallet-standard auto-discovery sometimes
  // registers the same wallet twice — e.g. MetaMask via both injected and Snap).
  // Keep installed wallets first, then loadable, hide unsupported.
  const visibleWallets = useMemo(() => {
    const seen = new Set<string>();
    const out: typeof wallets = [];
    const sorted = [...wallets].sort((a, b) => {
      const score = (w: typeof a) =>
        w.readyState === 'Installed' ? 0 : w.readyState === 'Loadable' ? 1 : 2;
      return score(a) - score(b);
    });
    for (const w of sorted) {
      if (w.readyState === 'Unsupported' || w.readyState === 'NotDetected') continue;
      if (seen.has(w.adapter.name)) continue;
      seen.add(w.adapter.name);
      out.push(w);
    }
    return out;
  }, [wallets]);

  // After select(), once the wallet adapter has switched, fire connect() once.
  // pendingWalletName is cleared as soon as connect is invoked so the effect
  // can't loop if the user dismisses the wallet popup.
  useEffect(() => {
    if (!pendingWalletName) return;
    if (!wallet || wallet.adapter.name !== pendingWalletName) return;
    if (connecting || connected) return;
    const walletName = wallet.adapter.name;
    setPendingWalletName(null);
    connect().catch(err => {
      console.error('Wallet connect failed:', err);
      toast.error('Wallet connection failed. Please try again.');
      posthog.capture('invite_wallet_connect_failed', {
        wallet_name: walletName,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, [pendingWalletName, wallet, connecting, connected, connect]);

  const handleSelectWallet = async (name: WalletName) => {
    if (connecting) return;
    posthog.capture('invite_wallet_selected', { wallet_name: name });
    // Already-selected wallet (restored from localStorage after refresh):
    // calling select() is a no-op, so connect() directly.
    if (wallet?.adapter.name === name) {
      try {
        await connect();
      } catch (err) {
        console.error('Wallet connect failed:', err);
        toast.error('Wallet connection failed. Please try again.');
        posthog.capture('invite_wallet_connect_failed', {
          wallet_name: name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }
    setPendingWalletName(name);
    select(name);
  };

  const handleRedeem = async () => {
    if (!publicKey || !signMessage) {
      toast.error('Connect a wallet first.');
      return;
    }
    const wallet = publicKey.toBase58();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      toast.error('Enter your invite code.');
      return;
    }

    setSubmitting(true);
    posthog.capture('invite_redeem_attempted', { wallet_address: wallet });
    try {
      const challenge = await requestChallenge(wallet, 'redeem');
      const sigBytes = await signMessage(new TextEncoder().encode(challenge.message));
      const granted = await redeemInvite({
        wallet,
        code: trimmed,
        nonce: challenge.nonce,
        signature: bs58.encode(sigBytes),
      });
      setSession(prev => ({
        ...prev,
        [wallet]: { token: granted.token, expiresAt: granted.expires_at },
      }));
      writeSession({
        wallet,
        token: granted.token,
        expiresAt: granted.expires_at,
        cachedAt: Date.now(),
      });
      posthog.capture('invite_redeem_succeeded', { wallet_address: wallet });

      // Best-effort referral bind. A wallet redeeming an invite is the ideal
      // attribution moment (no prior trades), and we now hold a session token,
      // so bind here. The invite is already redeemed — a referral failure must
      // never block entry, so we surface it as a soft toast and continue.
      const ref = referralCode.trim();
      if (ref) {
        try {
          await bindCode(granted.token, ref);
          toast.success('Referral code applied.');
          posthog.capture('invite_referral_bound', { wallet_address: wallet });
        } catch (e) {
          const refCode = e instanceof ReferralsError ? e.code : 'network_error';
          toast.error(REFERRAL_ERROR_COPY[refCode] ?? 'Referral code could not be applied.');
          posthog.capture('invite_referral_bind_failed', {
            wallet_address: wallet,
            error_code: refCode,
          });
        }
      }

      toast.success('Welcome to Fermilabs.');
      setOpen(false);
      setCode('');
    } catch (e) {
      if (e instanceof AccessGateError) {
        toast.error(ERROR_COPY[e.code] ?? `Could not redeem (${e.code}).`);
        posthog.capture('invite_redeem_failed', { wallet_address: wallet, error_code: e.code });
      } else {
        toast.error('Network error. Please retry.');
        posthog.capture('invite_redeem_failed', {
          wallet_address: wallet,
          error_code: 'network_error',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) handleDismiss();
      }}
    >
      <DialogContent className="max-w-md gap-6 p-6">
        {!acknowledged ? (
          // ── Step 1: Beta acknowledgement ──
          <>
            <DialogHeader className="gap-4">
              <HeaderIcon>
                <Atom weight="duotone" className="size-7" />
              </HeaderIcon>
              <div className="flex flex-col gap-2">
                <DialogTitle className="text-lg font-semibold tracking-tight">
                  Welcome to Fermilabs
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                  A few things to know before you start trading.
                </DialogDescription>
              </div>
            </DialogHeader>

            <ul className="flex flex-col gap-2.5">
              {BETA_ITEMS.map((item, i) => (
                <li
                  key={i}
                  className="text-sm text-muted-foreground border-l-2 border-accent/30 pl-3 py-1 leading-relaxed"
                >
                  {item}
                </li>
              ))}
            </ul>

            <Button onClick={handleAcknowledge} size="lg" className="w-full">
              I understand, continue
            </Button>
          </>
        ) : // ── Step 2: Wallet connect ──
        !publicKey ? (
          <>
            <DialogHeader className="gap-4">
              <HeaderIcon>
                <Wallet className="size-6" />
              </HeaderIcon>
              <div className="flex flex-col gap-2">
                <DialogTitle className="text-lg font-semibold tracking-tight">
                  Connect your wallet
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                  Connect a Solana wallet first. We'll then ask you for your invite code.
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              {visibleWallets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center border border-outline">
                  No Solana wallet detected. Install Phantom, Solflare, or Backpack.
                </p>
              ) : (
                visibleWallets.map(w => {
                  const isPending = pendingWalletName === w.adapter.name;
                  const isActive = wallet?.adapter.name === w.adapter.name && connecting;
                  const busy = isPending || isActive;
                  return (
                    <button
                      key={w.adapter.name}
                      type="button"
                      disabled={busy}
                      onClick={() => handleSelectWallet(w.adapter.name)}
                      className="flex items-center gap-3 px-3 py-2.5 border border-outline bg-card hover:border-accent/40 hover:bg-accent/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-left outline-none focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                    >
                      <img src={w.adapter.icon} alt="" className="size-7 shrink-0" aria-hidden />
                      <span className="flex-1 text-sm font-medium">{w.adapter.name}</span>
                      {busy ? (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          {w.readyState === 'Installed' ? 'Detected' : 'Install'}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-outline pt-4">
              <span className="text-sm text-muted-foreground">No invite code?</span>
              <Button variant="outline" size="sm" onClick={openWaitlist}>
                Join the waitlist
                <ArrowRight weight="bold" className="size-3.5" />
              </Button>
            </div>
          </>
        ) : gateLoading ? (
          // ── Step 2.5: Silent re-sign in flight (whitelisted wallets) ──
          // Show a spinner instead of the code form so the user isn't asked
          // to enter a code while their wallet signature popup is open.
          <>
            <DialogHeader className="gap-4">
              <HeaderIcon>
                <Key weight="duotone" className="size-7" />
              </HeaderIcon>
              <div className="flex flex-col gap-2">
                <DialogTitle className="text-lg font-semibold tracking-tight">
                  Checking access…
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                  Approve the signature request in your wallet to continue.
                </DialogDescription>
              </div>
            </DialogHeader>
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          </>
        ) : (
          // ── Step 3: Redeem invite code ──
          <>
            <DialogHeader className="gap-4">
              <HeaderIcon>
                <Key weight="duotone" className="size-7" />
              </HeaderIcon>
              <div className="flex flex-col gap-2">
                <DialogTitle className="text-lg font-semibold tracking-tight">
                  Enter your invite code
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                  Wallet connected. Paste the code we sent you to unlock trading.
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Invite Code
                </label>
                <Input
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="FERMI-XXXX-XXXX"
                  disabled={submitting}
                  spellCheck={false}
                  autoComplete="off"
                  className="h-11 font-mono text-sm tracking-widest placeholder:tracking-normal placeholder:font-sans placeholder:text-muted-foreground/40"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !submitting && code.trim()) {
                      e.preventDefault();
                      void handleRedeem();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground/70 leading-relaxed">
                  You'll sign a one-time message to prove wallet ownership. No transaction or gas
                  fee.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Referral Code
                  <span className="font-sans tracking-normal text-muted-foreground/50 normal-case">
                    Optional
                  </span>
                </label>
                <Input
                  value={referralCode}
                  onChange={e => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="friend's referral code"
                  disabled={submitting}
                  spellCheck={false}
                  autoComplete="off"
                  maxLength={20}
                  className="h-11 font-mono text-sm uppercase tracking-wider placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground/40"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !submitting && code.trim()) {
                      e.preventDefault();
                      void handleRedeem();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground/70 leading-relaxed">
                  Were you referred? Add their code to credit them — it must be applied before your
                  first trade.
                </p>
              </div>

              <Button
                onClick={handleRedeem}
                disabled={submitting || !code.trim()}
                size="lg"
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  'Redeem'
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-outline pt-4">
              <span className="text-sm text-muted-foreground">No invite code?</span>
              <Button variant="outline" size="sm" onClick={openWaitlist}>
                Join the waitlist
                <ArrowRight weight="bold" className="size-3.5" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
