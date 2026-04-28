/**
 * Invite-code redemption modal.
 *
 * Shows when a connected wallet is not whitelisted. Walks the user through:
 *   1. paste code,
 *   2. wallet pops up to sign a server-issued challenge,
 *   3. backend atomically burns the code + whitelists the wallet + issues a token.
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
      // Don't let the user click outside to dismiss — the gate is mandatory
      // for write actions, and silently closing leaves the user stuck. They
      // can disconnect their wallet to bail out.
      onOpenChange={next => {
        if (!submitting) setOpen(next);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite-only access</DialogTitle>
          <DialogDescription>
            Fermilabs is in private beta. Enter your invite code to unlock trading on this wallet.
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
            You’ll be asked to sign a one-time message to prove wallet ownership. No transaction or
            gas fee.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
