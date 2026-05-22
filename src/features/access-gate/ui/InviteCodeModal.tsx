import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtom, useSetAtom } from 'jotai';
import { Loader2 } from 'lucide-react';
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
import { gateOpenAtom, accessSessionAtom } from '../model/accessAtoms';
import { writeSession } from '../lib/cache';
import { waitlistOpenAtom, waitlistSourceAtom } from '@/features/waitlist';

const BETA_ACK_KEY = 'fermi.betaAck';

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
  const [open, setOpen] = useAtom(gateOpenAtom);
  const [, setSession] = useAtom(accessSessionAtom);
  const [code, setCode] = useState('');
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
    if (publicKey) {
      disconnect().catch(err => {
        console.error('Wallet disconnect failed:', err);
      });
    }
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
      toast.success('Welcome to Fermilabs.');
      setOpen(false);
      setCode('');
      posthog.capture('invite_redeem_succeeded', { wallet_address: wallet });
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
        ) : (
          // ── Step 2: Redeem invite code ──
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
