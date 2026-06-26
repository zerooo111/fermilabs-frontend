/**
 * The page's center of gravity: get your code, then share it.
 *
 * Because a wallet mints at most one code (`MAX_CODES_PER_WALLET`), this is a
 * single-code surface — there is no "codes list". New users see a one-click
 * create flow (custom code behind a small expander); returning users see their
 * code with sharing front-and-centre, led by "Share on X".
 */
import { useState } from 'react';
import { Check, ChevronDown, Copy, Link2, Loader2, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import posthog from 'posthog-js';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { cn } from '@/lib/utils';

import { MAX_REFERRALS_PER_CODE, REWARD_RATE_LABEL } from '../model/constants';
import { copy, shareLink, tweetIntent } from '../model/format';
import { FOCUS_RING, Panel } from './primitives';

const VALUE_PROP = `Earn ${REWARD_RATE_LABEL} of every trade your friends make on Fermi — forever, paid in USDC. Refer a friend who trades $1M and you earn $200.`;

export function HeroPanel({
  codes,
  onCreate,
  loading,
}: {
  codes: string[];
  onCreate: (code?: string) => Promise<string | null>;
  loading: boolean;
}) {
  const code = codes[0]?.toUpperCase() ?? null;

  return (
    <Panel className="bg-card/30">
      <div className="flex flex-col gap-5 p-5 md:p-6">
        {loading ? (
          <HeroSkeleton />
        ) : code ? (
          <ShareCode code={code} />
        ) : (
          <CreateCode onCreate={onCreate} />
        )}
      </div>
    </Panel>
  );
}

function HeroSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="skeleton-bone h-4 w-40" />
      <div className="skeleton-bone h-10 w-64" />
      <div className="flex gap-2">
        <div className="skeleton-bone h-9 w-32" />
        <div className="skeleton-bone h-9 w-28" />
      </div>
    </div>
  );
}

// ─── create ──────────────────────────────────────────────────────────

function CreateCode({ onCreate }: { onCreate: (code?: string) => Promise<string | null> }) {
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreate = async (useCustom: boolean) => {
    const value = useCustom ? custom.trim() : undefined;
    if (useCustom && !value) {
      toast.error('Enter a code or create a random one.');
      return;
    }
    setCreating(true);
    posthog.capture('referral_code_create_attempted', { vanity: useCustom });
    const created = await onCreate(value);
    setCreating(false);
    if (created) {
      setCustom('');
      toast.success(`Referral code ${created} created.`);
      posthog.capture('referral_code_create_succeeded', { code: created });
    } else {
      posthog.capture('referral_code_create_failed');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-rock">Create your referral code</h2>
        <p className="max-w-xl text-sm leading-relaxed text-white/65">{VALUE_PROP}</p>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          className={cn('h-10 w-full gap-2 sm:w-auto sm:self-start sm:px-6', FOCUS_RING)}
          disabled={creating}
          onClick={() => handleCreate(false)}
        >
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Create my code
        </Button>

        <button
          type="button"
          disabled={creating}
          onClick={() => setShowCustom(v => !v)}
          className={cn(
            'flex items-center gap-1 self-start text-xs text-white/55 transition-colors hover:text-white/80 disabled:opacity-40',
            FOCUS_RING
          )}
        >
          <ChevronDown
            className={cn('size-3.5 transition-transform', showCustom && 'rotate-180')}
          />
          Use a custom code instead
        </button>

        {showCustom && (
          <div className="flex max-w-md gap-2">
            <Input
              value={custom}
              onChange={e => setCustom(e.target.value.toUpperCase())}
              placeholder="custom code"
              disabled={creating}
              spellCheck={false}
              autoComplete="off"
              maxLength={20}
              className={cn('h-10 text-sm uppercase placeholder:normal-case', FOCUS_RING)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !creating && custom.trim()) {
                  e.preventDefault();
                  void handleCreate(true);
                }
              }}
            />
            <Button
              className={cn('h-10 shrink-0 gap-1.5 px-4', FOCUS_RING)}
              disabled={creating || !custom.trim()}
              onClick={() => handleCreate(true)}
            >
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── share ───────────────────────────────────────────────────────────

function ShareCode({ code }: { code: string }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const link = shareLink(code);

  const flash = (set: (v: boolean) => void) => {
    set(true);
    setTimeout(() => set(false), 1500);
  };

  const handleCopyCode = async () => {
    if (await copy(code, 'Code')) {
      posthog.capture('referral_code_copied', { code });
      flash(setCopiedCode);
    }
  };

  const handleCopyLink = async () => {
    if (await copy(link, 'Share link')) {
      posthog.capture('referral_link_copied', { code });
      flash(setCopiedLink);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed text-white/65">{VALUE_PROP}</p>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-white/50">Your referral code</span>
          <code className="font-mono text-3xl font-semibold tracking-[0.2em] text-rock">
            {code}
          </code>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          asChild
          className={cn('h-10 gap-2 px-5', FOCUS_RING)}
          onClick={() => posthog.capture('referral_share_x', { code })}
        >
          <a href={tweetIntent(code)} target="_blank" rel="noopener noreferrer">
            <XIcon className="size-4" />
            Share on X
          </a>
        </Button>
        <Button
          variant="outline"
          className={cn('h-10 gap-1.5 px-4', FOCUS_RING)}
          onClick={handleCopyLink}
        >
          {copiedLink ? <Check className="size-4" /> : <Link2 className="size-4" />}
          {copiedLink ? 'Copied' : 'Copy link'}
        </Button>
        <Button
          variant="outline"
          className={cn('h-10 gap-1.5 px-4', FOCUS_RING)}
          onClick={handleCopyCode}
        >
          {copiedCode ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copiedCode ? 'Copied' : 'Copy code'}
        </Button>
      </div>

      <p className="text-[11px] leading-relaxed text-white/45">
        Up to {MAX_REFERRALS_PER_CODE} referrals per code during beta — this limit will increase.
      </p>
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}
