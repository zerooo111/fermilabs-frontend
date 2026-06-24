/**
 * Referral dashboard — the full-page hub for the referral programme.
 *
 * Two audiences share the page:
 *  - Referrers: mint/share codes, watch referees + accrued rewards, and claim.
 *  - Referees: apply a friend's code (pre-filled from a `?ref=` share link) at
 *    any time — once per wallet, forever.
 *
 * Auth reuses the access-gate session via `useReferrals`; the body fails gently
 * (connect / redeem prompt) when the wallet isn't authorized. Money is shown
 * from the backend's `*_usdc` convenience views — we never do lots→USDC math
 * client-side.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  AlertTriangle,
  Check,
  Coins,
  Copy,
  Gift,
  Loader2,
  Plus,
  Share2,
  Ticket,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import posthog from 'posthog-js';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { cn } from '@/lib/utils';

import { useReferrals } from '../model/useReferrals';
import { REWARD_RATE_LABEL } from '../model/constants';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-rock/40">
      {children}
    </span>
  );
}

function usd(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return '$0.00';
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function shortWallet(w: string): string {
  return w.length > 12 ? `${w.slice(0, 4)}…${w.slice(-4)}` : w;
}

function shareLink(code: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.fermi.trade';
  return `${origin}/referrals?ref=${encodeURIComponent(code)}`;
}

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard.`);
  } catch {
    toast.error('Could not copy to clipboard.');
  }
}

export function ReferralDashboard() {
  const { publicKey } = useWallet();
  const { authorized, me, referees, loading, error, createCode, bind, claim, refresh } =
    useReferrals();

  if (!publicKey || !authorized) {
    return <UnauthorizedState connected={!!publicKey} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <StatGrid
        claimable={me?.claimable_usdc}
        lifetime={me?.lifetime_reward_usdc}
        pending={me?.pending_today_usdc}
        refereeCount={me?.referee_count ?? 0}
        loading={loading && !me}
      />

      {error && (
        <p className="border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="flex flex-col gap-6 lg:col-span-3">
          <CodesCard codes={me?.codes ?? []} onCreate={createCode} loading={loading && !me} />
          <RefereesCard referees={referees} loading={loading && !me} />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-2">
          <ClaimCard
            claimable={me?.claimable_usdc ?? 0}
            minClaim={me?.min_claim_usdc ?? 0}
            onClaim={claim}
          />
          <BindCard onBind={bind} onBound={refresh} />
        </div>
      </div>
    </div>
  );
}

// ─── Unauthorized ────────────────────────────────────────────────────

function UnauthorizedState({ connected }: { connected: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 border border-outline bg-card px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center border border-outline bg-background text-rock/40">
        <Gift className="size-6" />
      </div>
      <h2 className="text-lg font-semibold text-rock">Referral programme</h2>
      <p className="max-w-sm text-sm leading-relaxed text-rock/50">
        {connected
          ? 'This wallet does not have access yet. Redeem an invite to mint a referral code and start earning.'
          : 'Connect a whitelisted wallet to mint a referral code, track your referrals, and claim rewards.'}
      </p>
      <p className="max-w-sm text-xs leading-relaxed text-rock/40">
        Earn {REWARD_RATE_LABEL} of the taker volume traded by everyone you refer — forever.
      </p>
    </div>
  );
}

// ─── Stats ───────────────────────────────────────────────────────────

function StatGrid({
  claimable,
  lifetime,
  pending,
  refereeCount,
  loading,
}: {
  claimable?: number;
  lifetime?: number;
  pending?: number;
  refereeCount: number;
  loading: boolean;
}) {
  const cards = [
    { label: 'Claimable', value: usd(claimable), icon: Coins, accent: true },
    { label: 'Lifetime earned', value: usd(lifetime), icon: TrendingUp },
    { label: 'Pending today', value: usd(pending), icon: Wallet },
    { label: 'Referees', value: refereeCount.toLocaleString(), icon: Users },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(c => (
        <div
          key={c.label}
          className={cn(
            'flex flex-col gap-3 border bg-card p-4',
            c.accent ? 'border-success/30 bg-success/5' : 'border-outline'
          )}
        >
          <div className="flex items-center justify-between">
            <FieldLabel>{c.label}</FieldLabel>
            <c.icon className={cn('size-3.5', c.accent ? 'text-success' : 'text-rock/40')} />
          </div>
          {loading ? (
            <div className="skeleton-bone h-7 w-24" />
          ) : (
            <span
              className={cn(
                'font-mono text-2xl font-semibold tabular-nums',
                c.accent ? 'text-success' : 'text-rock'
              )}
            >
              {c.value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Codes ───────────────────────────────────────────────────────────

function CodesCard({
  codes,
  onCreate,
  loading,
}: {
  codes: string[];
  onCreate: (code?: string) => Promise<string | null>;
  loading: boolean;
}) {
  const [vanity, setVanity] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async (useVanity: boolean) => {
    const code = useVanity ? vanity.trim() : undefined;
    if (useVanity && !code) {
      toast.error('Enter a code or generate a random one.');
      return;
    }
    setCreating(true);
    posthog.capture('referral_code_create_attempted', { vanity: useVanity });
    const created = await onCreate(code);
    setCreating(false);
    if (created) {
      setVanity('');
      toast.success(`Referral code ${created} created.`);
      posthog.capture('referral_code_create_succeeded', { code: created });
    } else {
      posthog.capture('referral_code_create_failed');
    }
  };

  return (
    <div className="flex flex-col gap-4 border border-outline bg-card p-5">
      <div className="flex items-center gap-2">
        <Ticket className="size-4 text-rock/50" />
        <h3 className="text-sm font-semibold text-rock">Your referral codes</h3>
      </div>

      {/* Create row */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Create a code</FieldLabel>
        <div className="flex gap-2">
          <Input
            value={vanity}
            onChange={e => setVanity(e.target.value.toUpperCase())}
            placeholder="custom code (optional)"
            disabled={creating}
            spellCheck={false}
            autoComplete="off"
            maxLength={20}
            className="h-10 text-sm uppercase placeholder:normal-case"
            onKeyDown={e => {
              if (e.key === 'Enter' && !creating && vanity.trim()) {
                e.preventDefault();
                void handleCreate(true);
              }
            }}
          />
          <Button
            size="lg"
            className="h-10 shrink-0 gap-1.5 px-4"
            disabled={creating || !vanity.trim()}
            onClick={() => handleCreate(true)}
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create
          </Button>
        </div>
        <button
          type="button"
          disabled={creating}
          onClick={() => handleCreate(false)}
          className="self-start font-mono text-[11px] uppercase tracking-wide text-rock/40 underline-offset-2 transition-colors hover:text-rock/70 hover:underline disabled:opacity-50"
        >
          or generate a random code
        </button>
      </div>

      {/* Code list */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Share to earn</FieldLabel>
        {loading ? (
          <div className="flex items-center justify-center gap-2 border border-outline bg-background py-8 text-sm text-rock/50">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : codes.length === 0 ? (
          <p className="border border-outline bg-background px-4 py-8 text-center text-sm text-rock/50">
            No codes yet. Create one above to start referring.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {codes.map(code => (
              <CodeRow key={code} code={code} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CodeRow({ code }: { code: string }) {
  const [copiedLink, setCopiedLink] = useState(false);
  // Codes are case-insensitive; always display/share the upper-case form so
  // legacy lower-case codes still render consistently.
  const display = code.toUpperCase();

  const handleCopyLink = async () => {
    await copy(shareLink(display), 'Share link');
    posthog.capture('referral_link_copied', { code: display });
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1500);
  };

  return (
    <div className="flex items-center justify-between gap-3 border border-outline bg-background p-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <code className="truncate font-mono text-sm font-semibold tracking-wider text-rock">
          {display}
        </code>
        <span className="truncate font-mono text-[11px] text-rock/40">{shareLink(display)}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-rock/50 hover:text-rock"
          onClick={() => copy(display, 'Code')}
          aria-label="Copy code"
        >
          <Copy className="size-3.5" />
          Code
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleCopyLink}
          aria-label="Copy share link"
        >
          {copiedLink ? (
            <>
              <Check className="size-3.5 text-success" /> Copied
            </>
          ) : (
            <>
              <Share2 className="size-3.5" /> Share
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Referees ────────────────────────────────────────────────────────

function RefereesCard({
  referees,
  loading,
}: {
  referees: ReturnType<typeof useReferrals>['referees'];
  loading: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 border border-outline bg-card p-5">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-rock/50" />
        <h3 className="text-sm font-semibold text-rock">Your referees</h3>
        {referees.length > 0 && (
          <span className="font-mono text-[11px] tabular-nums text-rock/40">
            ({referees.length})
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 border border-outline bg-background py-10 text-sm text-rock/50">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : referees.length === 0 ? (
        <p className="border border-outline bg-background px-4 py-10 text-center text-sm text-rock/50">
          No referees yet. Share your code to start earning rewards.
        </p>
      ) : (
        <div className="max-h-[320px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Wallet</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Earned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referees.map(r => (
                <TableRow key={r.referee_wallet}>
                  <TableCell className="font-mono text-xs text-rock/80">
                    {shortWallet(r.referee_wallet)}
                  </TableCell>
                  <TableCell className="text-xs text-rock/50">{formatDate(r.bound_at)}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-success">
                    {usd(r.accrued_reward_usdc)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Claim ───────────────────────────────────────────────────────────

function ClaimCard({
  claimable,
  minClaim,
  onClaim,
}: {
  claimable: number;
  minClaim: number;
  onClaim: () => Promise<{ amount_usdc: number } | null>;
}) {
  const [claiming, setClaiming] = useState(false);
  const belowMin = claimable < minClaim;
  const progress = minClaim > 0 ? Math.min(100, (claimable / minClaim) * 100) : 0;

  const handleClaim = async () => {
    setClaiming(true);
    posthog.capture('referral_claim_attempted', { claimable });
    const result = await onClaim();
    setClaiming(false);
    if (result) {
      toast.success(
        `Claim requested for ${usd(result.amount_usdc)}. It will be paid to your wallet.`
      );
      posthog.capture('referral_claim_succeeded', { amount_usdc: result.amount_usdc });
    } else {
      posthog.capture('referral_claim_failed');
    }
  };

  return (
    <div className="flex flex-col gap-4 border border-success/30 bg-success/5 p-5">
      <div className="flex items-center gap-2">
        <Coins className="size-4 text-success" />
        <h3 className="text-sm font-semibold text-rock">Claim rewards</h3>
      </div>

      <div className="flex flex-col gap-1">
        <FieldLabel>Available to claim</FieldLabel>
        <span className="font-mono text-3xl font-semibold tabular-nums text-success">
          {usd(claimable)}
        </span>
      </div>

      {belowMin && (
        <div className="flex flex-col gap-2">
          <div className="h-1.5 w-full overflow-hidden bg-rock/10">
            <div
              className="h-full bg-success/60 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] leading-relaxed text-rock/50">
            Minimum payout is {usd(minClaim)}. Keep referring to reach the threshold.
          </p>
        </div>
      )}

      <Button
        variant="success"
        size="lg"
        className="w-full"
        disabled={claiming || belowMin || claimable <= 0}
        onClick={handleClaim}
      >
        {claiming ? <Loader2 className="size-4 animate-spin" /> : <Coins className="size-4" />}
        {belowMin ? `Reach ${usd(minClaim)} to claim` : 'Claim rewards'}
      </Button>
      <p className="text-[11px] leading-relaxed text-rock/40">
        Claims are paid out in USDC to your connected wallet by the treasury. The pending amount is
        removed from your claimable balance once requested.
      </p>
    </div>
  );
}

// ─── Bind ────────────────────────────────────────────────────────────

function BindCard({
  onBind,
  onBound,
}: {
  onBind: (code: string) => Promise<boolean>;
  onBound: () => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  // Codes are case-insensitive and normalized to upper-case server-side; mirror
  // that in the UI so what the user sees matches what gets stored.
  const refFromUrl = (searchParams.get('ref') ?? '').toUpperCase();
  const [code, setCode] = useState(refFromUrl);
  const [binding, setBinding] = useState(false);
  const [bound, setBound] = useState(false);

  // Keep the input in sync if the user lands via a fresh `?ref=` link.
  useEffect(() => {
    if (refFromUrl) setCode(refFromUrl);
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
      // Clear the ?ref= param so a refresh doesn't re-trigger.
      if (refFromUrl) {
        searchParams.delete('ref');
        setSearchParams(searchParams, { replace: true });
      }
      onBound();
    } else {
      posthog.capture('referral_bind_failed');
    }
  };

  if (bound) {
    return (
      <div className="flex flex-col items-center gap-3 border border-success/30 bg-success/5 p-5 text-center">
        <div className="flex size-10 items-center justify-center border border-success/40 bg-success/10 text-success">
          <Check className="size-5" />
        </div>
        <p className="text-sm font-medium text-rock">Referral code applied</p>
        <p className="max-w-[18rem] text-xs leading-relaxed text-rock/50">
          You're all set — your referrer earns a share of your taker volume from here on.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-4 border bg-card p-5',
        fromLink ? 'border-rock/30' : 'border-outline'
      )}
    >
      <div className="flex items-center gap-2">
        <Gift className="size-4 text-rock/50" />
        <h3 className="text-sm font-semibold text-rock">Have a referral code?</h3>
      </div>
      <p className="text-xs leading-relaxed text-rock/50">
        Apply a friend's code <span className="text-rock/70">any time</span> — they'll earn on the
        volume you trade from here on. It links your wallet to them permanently, so you can only do
        this once.
      </p>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="referral code"
          disabled={binding}
          spellCheck={false}
          autoComplete="off"
          maxLength={20}
          className="h-10 text-sm uppercase placeholder:normal-case"
          onKeyDown={e => {
            if (e.key === 'Enter' && !binding && code.trim()) {
              e.preventDefault();
              void handleBind();
            }
          }}
        />
        <Button
          size="lg"
          className="h-10 shrink-0 gap-1.5 px-4"
          disabled={binding || !code.trim()}
          onClick={handleBind}
        >
          {binding ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Apply
        </Button>
      </div>
      {fromLink && (
        <div className="flex items-start gap-2 border border-rock/20 bg-rock/5 px-3 py-2 text-[11px] leading-relaxed text-rock/60">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
          You followed a referral link. Applying this code permanently links your wallet to this
          referrer — you can only do it once.
        </div>
      )}
    </div>
  );
}
