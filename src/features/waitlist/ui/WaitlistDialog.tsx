import { useState } from 'react';
import { useAtom } from 'jotai';
import { Loader2 } from 'lucide-react';
import { CheckCircle } from '@phosphor-icons/react';
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
  invalid_email: "That email doesn't look right.",
  network_error: 'Network error. Please try again.',
};

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
      <DialogContent className="max-w-sm relative overflow-hidden">
        <GridOverlay />

        {submitted ? (
          // ── Success state ──
          <div className="relative flex flex-col gap-5">
            <div className="flex flex-col items-center gap-4 py-3 text-center">
              <div className="flex size-14 items-center justify-center border border-success/25 bg-success/10">
                <CheckCircle weight="duotone" className="size-7 text-success" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-success">
                  Access Requested
                </span>
                <DialogTitle className="text-base font-semibold">You're on the list</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  We'll email you when a spot opens. Watch for our note from fermilabs.io.
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Close
            </Button>
          </div>
        ) : (
          // ── Form state ──
          <div className="relative flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-[0.15em] text-accent border border-accent/30 bg-accent/5 px-2 py-0.5 w-fit">
                Waitlist
              </span>
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">Get early access</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  We're onboarding traders in waves. Drop your email and we'll send an invite when a
                  spot opens.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Email
                </label>
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

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Twitter / X{' '}
                  <span className="normal-case tracking-normal opacity-50 font-sans text-[10px]">
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
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting || !email.trim()}
                className="w-full"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Submitting…
                  </span>
                ) : (
                  'Request access'
                )}
              </Button>

              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/50 text-center">
                No spam — invite only
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
