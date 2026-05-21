import { useState } from 'react';
import { useAtom } from 'jotai';
import { Loader2 } from 'lucide-react';
import { CheckCircle, EnvelopeSimple, ArrowRight } from '@phosphor-icons/react';
import { toast } from 'sonner';
import posthog from 'posthog-js';

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
  invalid_email: "That email doesn't look right.",
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
      posthog.capture('waitlist_submitted', {
        source: source ?? null,
        has_twitter: !!twitter.trim(),
      });
    } catch (e) {
      if (e instanceof WaitlistError) {
        toast.error(ERROR_COPY[e.code] ?? `Request failed (${e.code}).`);
        posthog.capture('waitlist_submission_failed', {
          source: source ?? null,
          error_code: e.code,
        });
      } else {
        toast.error('Network error. Please try again.');
        posthog.capture('waitlist_submission_failed', {
          source: source ?? null,
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
        if (submitting) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-md gap-6 p-6">
        {submitted ? (
          // ── Success state ──
          <>
            <div className="flex flex-col items-center gap-5 pt-4 pb-2 text-center">
              <div className="flex size-20 items-center justify-center border border-success/30 bg-success/10">
                <CheckCircle weight="duotone" className="size-12 text-success" />
              </div>
              <div className="flex flex-col gap-2">
                <DialogTitle className="text-xl font-semibold tracking-tight">
                  You're on the list
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                  We'll email you when a spot opens. Watch for our note from{' '}
                  <span className="font-mono text-foreground">fermilabs.io</span>.
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              className="w-full"
            >
              Close
            </Button>
          </>
        ) : (
          // ── Form state ──
          <>
            <DialogHeader className="gap-4">
              <div className="flex size-12 items-center justify-center border border-accent/30 bg-accent/10 text-accent">
                <EnvelopeSimple weight="duotone" className="size-7" />
              </div>
              <div className="flex flex-col gap-2">
                <DialogTitle className="text-lg font-semibold tracking-tight">
                  Get early access
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                  We're onboarding traders in waves. Drop your email and we'll send an invite when a
                  spot opens.
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={submitting}
                  spellCheck={false}
                  autoComplete="email"
                  className="h-11"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !submitting) {
                      e.preventDefault();
                      void handleSubmit();
                    }
                  }}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Twitter / X{' '}
                  <span className="normal-case tracking-normal opacity-60 font-sans">
                    (optional)
                  </span>
                </label>
                <Input
                  value={twitter}
                  onChange={e => setTwitter(e.target.value)}
                  placeholder="@yourhandle"
                  disabled={submitting}
                  spellCheck={false}
                  autoComplete="off"
                  className="h-11"
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting || !email.trim()}
                size="lg"
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  'Request access'
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-outline pt-4">
              <span className="text-sm text-muted-foreground">Already have an invite?</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  posthog.capture('waitlist_start_trading_clicked', { source: source ?? null });
                  setOpen(false);
                  reset();
                  window.location.href = 'https://app.fermi.trade/perps';
                }}
              >
                Start trading
                <ArrowRight weight="bold" className="size-3.5" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
