/**
 * "Were you referred?" — a one-time, secondary action, de-emphasized into a
 * collapsible footer. Most visitors are referrers, and `?ref=` links already
 * pre-fill the invite modal at the gate, so this is an edge entry point.
 *
 * If the wallet already has a referrer (from /me, or just bound this session),
 * we show a compact confirmation instead — one referrer per wallet, forever.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, ChevronDown, Gift, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import posthog from 'posthog-js';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { cn } from '@/lib/utils';

import type { ReferralBinding } from '../api/referralsClient';
import { formatDate, shortWallet } from '../model/format';
import { Eyebrow, FOCUS_RING, Panel } from './primitives';

export function BindPanel({
  referredBy,
  onBind,
  onBound,
}: {
  referredBy: ReferralBinding | null;
  onBind: (code: string) => Promise<boolean>;
  onBound: () => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const refFromUrl = (searchParams.get('ref') ?? '').toUpperCase();
  const [code, setCode] = useState(refFromUrl);
  const [binding, setBinding] = useState(false);
  const [bound, setBound] = useState(false);
  // Auto-open the form when the user arrived via a referral link.
  const [open, setOpen] = useState(!!refFromUrl);

  useEffect(() => {
    if (refFromUrl) {
      setCode(refFromUrl);
      setOpen(true);
    }
  }, [refFromUrl]);

  const fromLink = useMemo(() => !!refFromUrl, [refFromUrl]);

  const handleBind = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error('Enter a referral code.');
      return;
    }
    setBinding(true);
    posthog.capture('referral_bind_attempted', { from_link: fromLink });
    const ok = await onBind(trimmed);
    setBinding(false);
    if (ok) {
      setBound(true);
      toast.success('Referral code applied. Your referrer now earns on your trades.');
      posthog.capture('referral_bind_succeeded');
      if (refFromUrl) {
        searchParams.delete('ref');
        setSearchParams(searchParams, { replace: true });
      }
      onBound();
    } else {
      posthog.capture('referral_bind_failed');
    }
  };

  // Already bound — show a compact confirmation, never the input.
  if (referredBy || bound) {
    return (
      <Panel className="bg-card/20">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-white/70">
            <Check className="size-4 shrink-0 text-success" />
            You were referred
          </span>
          {referredBy && (
            <>
              <span className="flex items-center gap-2 text-xs">
                <Eyebrow>Code</Eyebrow>
                <code className="font-mono text-rock">{referredBy.code.toUpperCase()}</code>
              </span>
              <span className="flex items-center gap-2 text-xs">
                <Eyebrow>Referrer</Eyebrow>
                <span className="font-mono text-white/70">
                  {shortWallet(referredBy.referrer_wallet)}
                </span>
              </span>
              <span className="flex items-center gap-2 text-xs">
                <Eyebrow>Applied</Eyebrow>
                <span className="font-mono text-white/70">{formatDate(referredBy.bound_at)}</span>
              </span>
            </>
          )}
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="bg-card/20">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-2 px-4 py-3 text-left text-sm text-white/70 transition-colors hover:text-rock',
          FOCUS_RING
        )}
      >
        <Gift className="size-4 shrink-0 text-white/50" />
        Were you referred? Apply a friend&apos;s code
        <ChevronDown className={cn('ml-auto size-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-outline px-4 py-3">
          <p className="text-[11px] leading-relaxed text-white/55">
            Applying a code permanently links your wallet to that referrer — you can only do this
            once.
          </p>
          <div className="flex max-w-md gap-2">
            <Input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="referral code"
              disabled={binding}
              spellCheck={false}
              autoComplete="off"
              maxLength={20}
              className={cn('h-9 text-sm uppercase placeholder:normal-case', FOCUS_RING)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !binding && code.trim()) {
                  e.preventDefault();
                  void handleBind();
                }
              }}
            />
            <Button
              size="sm"
              className={cn('h-9 shrink-0 gap-1.5 px-3', FOCUS_RING)}
              disabled={binding || !code.trim()}
              onClick={handleBind}
            >
              {binding ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Apply
            </Button>
          </div>
          {fromLink && (
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-white/55">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
              You followed a referral link. Applying this code permanently links your wallet to this
              referrer.
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
