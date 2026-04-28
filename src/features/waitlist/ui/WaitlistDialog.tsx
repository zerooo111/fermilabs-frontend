/**
 * Public waitlist dialog. Mounted globally; opens via the `waitlistOpenAtom`.
 *
 * The backend always returns 200 on a well-formed submission (even on
 * duplicate emails) to avoid leaking which addresses are already on the
 * list, so the UI shows the same success state for all happy-path
 * outcomes.
 */
import { useState } from 'react';
import { useAtom } from 'jotai';
import { CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';

import { submitWaitlist, WaitlistError } from '../api/waitlistClient';
import { waitlistOpenAtom, waitlistSourceAtom } from '../model/waitlistAtoms';

const ERROR_COPY: Record<string, string> = {
  invalid_email: 'That email doesn’t look right.',
  network_error: 'Network error. Please try again.',
};

export function WaitlistDialog() {
  const [open, setOpen] = useAtom(waitlistOpenAtom);
  const [source, setSource] = useAtom(waitlistSourceAtom);
  const [email, setEmail] = useState('');
  const [twitter, setTwitter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reset = () => {
    setEmail('');
    setTwitter('');
    setSubmitted(false);
    setSource(null);
  };

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error('Enter your email.');
      return;
    }
    setSubmitting(true);
    try {
      await submitWaitlist({
        email: trimmedEmail,
        twitter: twitter.trim() || undefined,
        source: source || undefined,
      });
      setSubmitted(true);
    } catch (e) {
      if (e instanceof WaitlistError) {
        toast.error(ERROR_COPY[e.code] ?? `Request failed (${e.code}).`);
      } else {
        toast.error('Network error. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (submitting) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-sm">
        {submitted ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <CheckCircle className="size-5 text-amber-200" />
                <DialogTitle>You’re on the list</DialogTitle>
              </div>
              <DialogDescription>
                We’ll email you when there’s a spot open. Watch out for our note from fermilabs.io.
              </DialogDescription>
            </DialogHeader>
            <Button
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Close
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Join the Fermi waitlist</DialogTitle>
              <DialogDescription>
                We’re onboarding traders in waves. Drop your email and we’ll send an invite when a
                spot opens.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-rock/70">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  disabled={submitting}
                  spellCheck={false}
                  autoComplete="email"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !submitting) {
                      e.preventDefault();
                      void handleSubmit();
                    }
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-rock/70">Twitter / X handle (optional)</label>
                <Input
                  value={twitter}
                  onChange={e => setTwitter(e.target.value)}
                  placeholder="@yourhandle"
                  disabled={submitting}
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
              <Button onClick={handleSubmit} disabled={submitting || !email.trim()}>
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> Submitting…
                  </span>
                ) : (
                  'Request access'
                )}
              </Button>
              <p className="text-xs text-rock/60">
                No spam. We’ll only email you about your invite.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
