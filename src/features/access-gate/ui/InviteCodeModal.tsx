import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError } from '@solana/wallet-adapter-base';
import { useAtom, useAtomValue } from 'jotai';
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
import { useWalletLogin } from '@/entities/wallet';

import { AccessGateError, redeemInvite, requestChallenge } from '../api/accessClient';
import { gateOpenAtom, gateLoadingAtom, accessSessionAtom } from '../model/accessAtoms';
import { writeSession } from '../lib/cache';

const BETA_ACK_KEY = 'fermi.betaAck';
// Invites are handed out on Discord (kept in sync with LINKS.DISCORD).
const DISCORD_URL = 'https://discord.gg/kNcktKSk7u';

/**
 * Read an optional `?ref=` referral code from the current URL. Referral codes
 * double as invite codes, so a share link can pre-fill the invite field
 * directly — the gate redeems it and attributes the referrer server-side.
 */
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
  const { publicKey, signMessage, disconnect } = useWallet();
  const { openLogin, ready: loginReady } = useWalletLogin();
  const [open, setOpen] = useAtom(gateOpenAtom);
  const gateLoading = useAtomValue(gateLoadingAtom);
  const [, setSession] = useAtom(accessSessionAtom);
  // Pre-fill the invite field from a `?ref=` share link: a referral code is a
  // valid invite code, so redeeming it grants access and the backend attributes
  // the referrer automatically.
  const [code, setCode] = useState(() => readRefFromUrl());
  const [submitting, setSubmitting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(() => readBetaAck());

  const handleAcknowledge = () => {
    writeBetaAck();
    setAcknowledged(true);
    posthog.capture('invite_beta_acknowledged');
  };

  // Dismissing the gate returns the user to view-only by disconnecting the
  // wallet; otherwise an authenticated-only header (margin/fee) would render
  // alongside a wallet that hasn't redeemed a session.
  const handleDismiss = () => {
    setOpen(false);
    setCode('');
    if (publicKey) {
      disconnect().catch(err => {
        console.error('Wallet disconnect failed:', err);
      });
    }
  };

  // Hand off to Privy's modal. Close ours first (without the dismiss/disconnect
  // path) so the Radix focus trap doesn't block it; useAccessGate reopens the
  // gate on connect if the wallet still needs a code.
  const handleLogin = () => {
    posthog.capture('invite_login_opened');
    setOpen(false);
    openLogin();
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

      // If the redeemed code was a referral code, the backend already attributed
      // the referrer during redeem — nothing to do client-side.

      toast.success('Welcome to Fermilabs.');
      setOpen(false);
      setCode('');
    } catch (e) {
      if (e instanceof AccessGateError) {
        toast.error(ERROR_COPY[e.code] ?? `Could not redeem (${e.code}).`);
        posthog.capture('invite_redeem_failed', { wallet_address: wallet, error_code: e.code });
      } else if (e instanceof WalletError) {
        // Wallet refused or couldn't show the signature request — not a network issue.
        toast.error('Your wallet did not sign the request. Please try again.');
        posthog.capture('invite_redeem_failed', {
          wallet_address: wallet,
          error_code: 'wallet_error',
          error_name: e.name,
          error_message: e.message,
        });
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
                  Log in to Fermilabs
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                  Continue with email, Google, X, or a Solana wallet. We'll then ask you for your
                  invite or referral code.
                </DialogDescription>
              </div>
            </DialogHeader>

            <Button onClick={handleLogin} disabled={!loginReady} size="lg" className="w-full">
              {loginReady ? (
                'Log in or connect wallet'
              ) : (
                <Loader2 className="size-4 animate-spin" />
              )}
            </Button>

            <div className="flex items-center justify-between gap-3 border-t border-outline pt-4">
              <span className="text-sm text-muted-foreground">No invite code?</span>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => posthog.capture('invite_request_clicked')}
                >
                  Request an invite
                  <ArrowRight weight="bold" className="size-3.5" />
                </a>
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
                  Enter your code
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                  You're logged in. Paste an invite code or a referral code to unlock trading.
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Invite or Referral Code
                </label>
                <Input
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="FERMI-XXXX-XXXX or referral code"
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
                  Have a friend's referral code? It works here too — you'll get access and they'll
                  be credited. Your wallet signs a one-time message to prove ownership. No
                  transaction or gas fee.
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
              <Button variant="outline" size="sm" asChild>
                <a
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => posthog.capture('invite_request_clicked')}
                >
                  Request an invite
                  <ArrowRight weight="bold" className="size-3.5" />
                </a>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
