import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtom } from 'jotai';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { useSetAtom } from 'jotai';

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
  "You're using non-production software — don't risk more than you can afford to lose.",
  'Your feedback shapes what we build next.',
];

function GridOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.025]"
      style={{
        backgroundImage:
          'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    />
  );
}

function StepBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-[0.15em] text-accent border border-accent/30 bg-accent/5 px-2 py-0.5">
      {label}
    </span>
  );
}

export function InviteCodeModal() {
  const { publicKey, signMessage } = useWallet();
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
  };

  const openWaitlist = () => {
    setWaitlistSource('invite-modal');
    setWaitlistOpen(true);
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
    } catch (e) {
      if (e instanceof AccessGateError) {
        toast.error(ERROR_COPY[e.code] ?? `Could not redeem (${e.code}).`);
      } else {
        toast.error('Network error. Please retry.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        /* intentionally a no-op — gate is mandatory */
      }}
    >
      <DialogContent
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
        className="max-w-sm relative overflow-hidden [&>button.absolute]:hidden"
      >
        <GridOverlay />

        {!acknowledged ? (
          // ── Step 1: Beta acknowledgement ──
          <div className="relative flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <StepBadge label="Beta Access" />
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">Welcome to Fermilabs</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  A few things to know before you start trading.
                </DialogDescription>
              </DialogHeader>
            </div>

            <ul className="flex flex-col gap-2">
              {BETA_ITEMS.map((item, i) => (
                <li
                  key={i}
                  className="flex gap-3 text-xs text-muted-foreground border-l-2 border-accent/25 pl-3 py-0.5 leading-relaxed"
                >
                  {item}
                </li>
              ))}
            </ul>

            <Button onClick={handleAcknowledge} className="w-full">
              I understand, continue
            </Button>
          </div>
        ) : (
          // ── Step 2: Invite code ──
          <div className="relative flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <StepBadge label="Invite Code" />
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">Invite-only access</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  Enter your code to unlock trading on this wallet.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Code
                </label>
                <Input
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="FERMI-XXXX-XXXX"
                  autoFocus
                  disabled={submitting}
                  spellCheck={false}
                  autoComplete="off"
                  className="font-mono tracking-widest placeholder:tracking-normal placeholder:font-sans"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !submitting) {
                      e.preventDefault();
                      void handleRedeem();
                    }
                  }}
                />
              </div>

              <Button
                onClick={handleRedeem}
                disabled={submitting || !code.trim()}
                className="w-full"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Verifying…
                  </span>
                ) : (
                  'Redeem'
                )}
              </Button>

              <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                You'll be asked to sign a one-time message to prove wallet ownership. No transaction
                or gas fee.
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-outline pt-4">
              <span className="text-xs text-muted-foreground">No invite code?</span>
              <button
                type="button"
                onClick={openWaitlist}
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent hover:text-accent/70 transition-colors duration-150"
              >
                Join the waitlist →
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
