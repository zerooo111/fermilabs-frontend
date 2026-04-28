/**
 * Invite-code redemption modal.
 *
 * Two-step flow:
 *   1. **Beta acknowledgement** — first-time users on this device see a
 *      short "you're using beta software" notice and click "I agree" to
 *      continue. Acknowledgement is persisted per-browser in localStorage so
 *      returning users skip straight to step 2.
 *   2. **Redeem** — paste invite code, wallet signs a server-issued
 *      challenge, backend atomically burns the code + whitelists the wallet
 *      + issues a session token.
 *
 * Closing the modal does NOT disconnect the wallet — but the rest of the app
 * stays write-disabled until a session is established.
 */
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
  invalid_code: 'That code doesn’t look right.',
  code_unknown: 'Code not found.',
  code_unavailable: 'This code has already been used or expired.',
  invalid_challenge: 'Sign-in expired. Please try again.',
  bad_signature: 'Signature didn’t match. Please try again.',
  wallet_already_whitelisted: 'This wallet already has access.',
  oversized_input: 'Invalid input.',
  invalid_wallet: 'Wallet not recognized.',
  rate_limited: 'Too many attempts. Please wait a moment.',
};

export function InviteCodeModal() {
  const { publicKey, signMessage } = useWallet();
  const [open, setOpen] = useAtom(gateOpenAtom);
  const [, setSession] = useAtom(accessSessionAtom);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Beta ack is read once on mount; subsequent dialog opens on the same
  // device skip straight to the code step.
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
      // The gate is mandatory: no click-outside, no ESC, no X-button close.
      // Modal only closes via successful redemption (handleRedeem calls
      // setOpen(false)) or wallet disconnect (useAccessGate clears it). To
      // bail out, the user disconnects their wallet — there's no silent skip
      // path that leaves the app in an unauthenticated-but-rendered state.
      onOpenChange={() => {
        /* intentionally a no-op */
      }}
    >
      <DialogContent
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
        // Hides the absolutely-positioned X button baked into shared DialogContent.
        className="max-w-sm [&>button.absolute]:hidden"
      >
        {!acknowledged ? (
          // ── Step 1: Beta acknowledgement ──
          <>
            <DialogHeader>
              <DialogTitle>Welcome to the Fermilabs beta</DialogTitle>
              <DialogDescription>
                Thanks for being an early user. A few things to know before you continue.
              </DialogDescription>
            </DialogHeader>

            <ul className="flex flex-col gap-2 text-xs text-rock/80 leading-relaxed">
              <li>
                <span className="text-rock">•</span> We&apos;re shipping fast. Features, fees, and
                UX may change as we iterate.
              </li>
              <li>
                <span className="text-rock">•</span> Short downtimes and the occasional bug are
                possible during the beta.
              </li>
              <li>
                <span className="text-rock">•</span> You&apos;re using non-production software at
                your own risk — please don&apos;t risk more than you can afford to lose.
              </li>
              <li>
                <span className="text-rock">•</span> Your feedback shapes what we build next. Tell
                us what&apos;s broken or missing.
              </li>
            </ul>

            <Button onClick={handleAcknowledge}>I understand, continue</Button>
          </>
        ) : (
          // ── Step 2: Invite redemption ──
          <>
            <DialogHeader>
              <DialogTitle>Invite-only access</DialogTitle>
              <DialogDescription>
                Enter your invite code to unlock trading on this wallet.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <Input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="FERMI-XXXX-XXXX"
                autoFocus
                disabled={submitting}
                spellCheck={false}
                autoComplete="off"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !submitting) {
                    e.preventDefault();
                    void handleRedeem();
                  }
                }}
              />
              <Button onClick={handleRedeem} disabled={submitting || !code.trim()}>
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> Verifying…
                  </span>
                ) : (
                  'Redeem'
                )}
              </Button>
              <p className="text-xs text-rock/60">
                You&apos;ll be asked to sign a one-time message to prove wallet ownership. No
                transaction or gas fee.
              </p>
              <p className="text-xs text-rock/70 pt-1 border-t border-rock/15">
                Don&apos;t have a code?{' '}
                <button
                  type="button"
                  onClick={openWaitlist}
                  className="underline underline-offset-2 decoration-rock/40 hover:decoration-amber-200 hover:text-amber-100 duration-150 ease-out"
                >
                  Join the waitlist
                </button>
                .
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
