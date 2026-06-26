/**
 * Referral dashboard — the full-page hub for the referral programme.
 *
 * Two audiences share the page:
 *  - Referrers: mint/share codes, watch referees + accrued rewards, and claim.
 *  - Referees: apply a friend's code (pre-filled from a `?ref=` share link) at
 *    any time — once per wallet, forever.
 *
 * Visual language follows the trading terminal (perps page): flat panels
 * delineated by thin `border-outline` dividers and subtle `bg-card` headers —
 * no rounded cards, no tinted fills. Money is shown from the backend's `*_usdc`
 * convenience views — we never do lots→USDC math client-side.
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
  Receipt,
  Share2,
  Ticket,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import posthog from 'posthog-js';

import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { cn } from '@/lib/utils';
import { solanaExplorerTxUrl } from '@/shared/config/constants';

import { useReferrals } from '../model/useReferrals';
import { REWARD_RATE_LABEL, MAX_CODES_PER_WALLET } from '../model/constants';
import type { ReferralBinding, Payout, PayoutStatus } from '../api/referralsClient';

// ─── helpers ─────────────────────────────────────────────────────────

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

// ─── shared layout primitives ────────────────────────────────────────

function PanelHeader({
  icon: Icon,
  title,
  right,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex h-11 items-center gap-2 border-b border-outline bg-card px-4">
      <Icon className="size-3.5 text-white/40" />
      <span className="text-sm font-medium text-rock">{title}</span>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">
      {children}
    </span>
  );
}

function PanelEmpty({ loading, text }: { loading?: boolean; text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-white/40">
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Loading…
        </>
      ) : (
        text
      )}
    </div>
  );
}

// ─── root ────────────────────────────────────────────────────────────

export function ReferralDashboard() {
  const { publicKey } = useWallet();
  const {
    authorized,
    me,
    referees,
    payouts,
    loading,
    error,
    createCode,
    bind,
    requestPayout,
    refresh,
  } = useReferrals();

  if (!publicKey || !authorized) {
    return <UnauthorizedState connected={!!publicKey} />;
  }

  const initialLoad = loading && !me;

  return (
    <div className="border border-outline">
      <StatRow me={me} loading={initialLoad} />

      {error && (
        <div className="border-t border-outline bg-card px-4 py-2 text-xs text-danger">{error}</div>
      )}

      <div className="flex flex-col border-t border-outline lg:flex-row lg:divide-x lg:divide-outline">
        <div className="flex min-w-0 flex-1 flex-col divide-y divide-outline">
          <CodesPanel codes={me?.codes ?? []} onCreate={createCode} loading={initialLoad} />
          <RefereesPanel referees={referees} loading={initialLoad} />
          <PayoutsPanel payouts={payouts} loading={initialLoad} />
        </div>
        <div className="flex w-full flex-col divide-y divide-outline border-t border-outline lg:w-80 lg:border-t-0">
          <PayoutPanel
            claimable={me?.claimable_usdc ?? 0}
            minClaim={me?.min_claim_usdc ?? 0}
            onRequest={requestPayout}
          />
          <BindPanel referredBy={me?.referred_by ?? null} onBind={bind} onBound={refresh} />
        </div>
      </div>
    </div>
  );
}

// ─── unauthorized ────────────────────────────────────────────────────

function UnauthorizedState({ connected }: { connected: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 border border-outline px-6 py-16 text-center">
      <Gift className="size-6 text-white/30" />
      <h2 className="text-base font-medium text-rock">Referral programme</h2>
      <p className="max-w-sm text-sm leading-relaxed text-white/50">
        {connected
          ? 'This wallet does not have access yet. Redeem an invite to mint a referral code and start earning.'
          : 'Connect a whitelisted wallet to mint a referral code, track your referrals, and claim rewards.'}
      </p>
      <p className="max-w-sm text-xs leading-relaxed text-white/35">
        Earn {REWARD_RATE_LABEL} of the taker volume traded by everyone you refer — forever.
      </p>
    </div>
  );
}

// ─── overview strip ──────────────────────────────────────────────────

function StatRow({ me, loading }: { me: ReturnType<typeof useReferrals>['me']; loading: boolean }) {
  const cells = [
    { label: 'Claimable', value: usd(me?.claimable_usdc) },
    { label: 'Lifetime earned', value: usd(me?.lifetime_reward_usdc) },
    { label: 'Referees', value: (me?.referee_count ?? 0).toLocaleString() },
  ];
  return (
    <div className="grid grid-cols-3 divide-x divide-outline">
      {cells.map(c => (
        <div key={c.label} className="flex flex-col gap-1.5 p-4">
          <Label>{c.label}</Label>
          {loading ? (
            <div className="skeleton-bone h-6 w-20" />
          ) : (
            <span className="font-mono text-xl font-semibold tabular-nums text-rock">
              {c.value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── codes ───────────────────────────────────────────────────────────

function CodesPanel({
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
  const atLimit = codes.length >= MAX_CODES_PER_WALLET;

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
    <div className="flex flex-col">
      <PanelHeader
        icon={Ticket}
        title="Referral codes"
        right={
          <span className="font-mono text-[11px] tabular-nums text-white/40">
            {codes.length}/{MAX_CODES_PER_WALLET}
          </span>
        }
      />

      {/* Hide the create section entirely once the wallet is at its code limit. */}
      {!atLimit && (
        <div className="flex flex-col gap-2 border-b border-outline px-4 py-3">
          <div className="flex gap-2">
            <Input
              value={vanity}
              onChange={e => setVanity(e.target.value.toUpperCase())}
              placeholder="custom code (optional)"
              disabled={creating}
              spellCheck={false}
              autoComplete="off"
              maxLength={20}
              className="h-9 text-sm uppercase placeholder:normal-case"
              onKeyDown={e => {
                if (e.key === 'Enter' && !creating && vanity.trim()) {
                  e.preventDefault();
                  void handleCreate(true);
                }
              }}
            />
            <Button
              size="sm"
              className="h-9 shrink-0 gap-1.5 px-3"
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
            className="self-start font-mono text-[11px] uppercase tracking-wide text-white/40 underline-offset-2 transition-colors hover:text-white/70 hover:underline disabled:opacity-40"
          >
            or generate a random code
          </button>
        </div>
      )}

      {loading ? (
        <PanelEmpty loading />
      ) : codes.length === 0 ? (
        <PanelEmpty text="No codes yet. Create one above to start referring." />
      ) : (
        <div className="divide-y divide-outline">
          {codes.map(code => (
            <CodeRow key={code} code={code} />
          ))}
        </div>
      )}
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
    <div className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-card/60">
      <div className="flex min-w-0 flex-col gap-0.5">
        <code className="truncate font-mono text-sm font-semibold tracking-wider text-rock">
          {display}
        </code>
        <span className="truncate font-mono text-[11px] text-white/35">{shareLink(display)}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-white/50 hover:text-rock"
          onClick={() => copy(display, 'Code')}
          aria-label="Copy code"
        >
          <Copy className="size-3.5" />
          Copy
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
              <Check className="size-3.5" /> Copied
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

// ─── referees ────────────────────────────────────────────────────────

function RefereesPanel({
  referees,
  loading,
}: {
  referees: ReturnType<typeof useReferrals>['referees'];
  loading: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <PanelHeader
        icon={Users}
        title="Referees"
        right={
          referees.length > 0 ? (
            <span className="font-mono text-[11px] tabular-nums text-white/40">
              {referees.length}
            </span>
          ) : undefined
        }
      />

      {loading ? (
        <PanelEmpty loading />
      ) : referees.length === 0 ? (
        <PanelEmpty text="No referees yet. Share your code to start earning." />
      ) : (
        <>
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-3 border-b border-outline bg-card px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
            <span>Wallet</span>
            <span>Joined</span>
            <span className="text-right">Volume</span>
            <span className="text-right">Earned</span>
          </div>
          <div className="max-h-[320px] divide-y divide-outline overflow-y-auto">
            {referees.map(r => (
              <div
                key={r.referee_wallet}
                className="grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center gap-3 px-4 py-2.5"
              >
                <span className="truncate font-mono text-xs text-rock/90">
                  {shortWallet(r.referee_wallet)}
                </span>
                <span className="font-mono text-xs text-white/45">{formatDate(r.bound_at)}</span>
                <span className="text-right font-mono text-xs tabular-nums text-white/70">
                  {usd(r.accrued_volume_usdc)}
                </span>
                <span className="text-right font-mono text-xs tabular-nums text-rock">
                  {usd(r.accrued_reward_usdc)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── payout request ──────────────────────────────────────────────────

function PayoutPanel({
  claimable,
  minClaim,
  onRequest,
}: {
  claimable: number;
  minClaim: number;
  onRequest: () => Promise<{ amount_usdc: number } | null>;
}) {
  const [requesting, setRequesting] = useState(false);
  const belowMin = claimable < minClaim;
  const progress = minClaim > 0 ? Math.min(100, (claimable / minClaim) * 100) : 0;

  const handleRequest = async () => {
    setRequesting(true);
    posthog.capture('referral_payout_attempted', { claimable });
    const result = await onRequest();
    setRequesting(false);
    if (result) {
      toast.success(
        `Payout requested for ${usd(result.amount_usdc)}. We'll send it to your wallet and mark it complete.`
      );
      posthog.capture('referral_payout_succeeded', { amount_usdc: result.amount_usdc });
    } else {
      posthog.capture('referral_payout_failed');
    }
  };

  return (
    <div className="flex flex-col">
      <PanelHeader icon={Coins} title="Rewards" />
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1">
          <Label>Available to claim</Label>
          <span className="font-mono text-2xl font-semibold tabular-nums text-rock">
            {usd(claimable)}
          </span>
        </div>

        {belowMin && (
          <div className="flex flex-col gap-1.5">
            <div className="h-1 w-full overflow-hidden bg-white/10">
              <div className="h-full bg-rock/40 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[11px] leading-relaxed text-white/40">
              Minimum payout is {usd(minClaim)}. Keep referring to reach it.
            </span>
          </div>
        )}

        <Button
          className="w-full"
          disabled={requesting || belowMin || claimable <= 0}
          onClick={handleRequest}
        >
          {requesting ? <Loader2 className="size-4 animate-spin" /> : <Coins className="size-4" />}
          {belowMin ? `Reach ${usd(minClaim)} to request` : 'Request payout'}
        </Button>
        <p className="text-[11px] leading-relaxed text-white/35">
          Requesting moves the amount out of your claimable balance into a pending payout. We send
          the USDC to your wallet and mark it complete with the transaction.
        </p>
      </div>
    </div>
  );
}

// ─── payouts history ─────────────────────────────────────────────────

const STATUS_STYLE: Record<PayoutStatus, { dot: string; text: string; label: string }> = {
  requested: { dot: 'bg-white/40', text: 'text-white/60', label: 'Requested' },
  processing: { dot: 'bg-amber-400', text: 'text-amber-300', label: 'Processing' },
  completed: { dot: 'bg-success', text: 'text-success', label: 'Completed' },
  failed: { dot: 'bg-danger', text: 'text-danger', label: 'Failed' },
};

function StatusChip({ status }: { status: PayoutStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.requested;
  return (
    <span className="flex items-center justify-end gap-1.5">
      <span className={cn('size-1.5 rounded-full', s.dot)} />
      <span className={cn('font-mono text-[10px] uppercase tracking-[0.12em]', s.text)}>
        {s.label}
      </span>
    </span>
  );
}

function PayoutsPanel({ payouts, loading }: { payouts: Payout[]; loading: boolean }) {
  // Hide the panel entirely until there's a payout to show.
  if (!loading && payouts.length === 0) return null;

  return (
    <div className="flex flex-col">
      <PanelHeader
        icon={Receipt}
        title="Payouts"
        right={
          payouts.length > 0 ? (
            <span className="font-mono text-[11px] tabular-nums text-white/40">
              {payouts.length}
            </span>
          ) : undefined
        }
      />
      {loading ? (
        <PanelEmpty loading />
      ) : (
        <>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-3 border-b border-outline bg-card px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
            <span>Amount</span>
            <span>Requested</span>
            <span className="text-right">Status</span>
          </div>
          <div className="divide-y divide-outline">
            {payouts.map(p => (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_1fr_auto] items-center gap-x-3 gap-y-1.5 px-4 py-2.5"
              >
                <span className="font-mono text-xs tabular-nums text-rock">
                  {usd(p.amount_usdc)}
                </span>
                <span className="font-mono text-xs text-white/45">
                  {formatDate(p.requested_at)}
                </span>
                <StatusChip status={p.status} />
                {p.tx_signature && (
                  <a
                    href={solanaExplorerTxUrl(p.tx_signature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="col-span-3 truncate font-mono text-[11px] text-white/35 underline-offset-2 transition-colors hover:text-white/60 hover:underline"
                  >
                    tx {p.tx_signature.slice(0, 8)}…{p.tx_signature.slice(-8)}
                  </a>
                )}
                {p.note && <span className="col-span-3 text-[11px] text-white/35">{p.note}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── bind ────────────────────────────────────────────────────────────

function BindPanel({
  referredBy,
  onBind,
  onBound,
}: {
  referredBy: ReferralBinding | null;
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
      if (refFromUrl) {
        searchParams.delete('ref');
        setSearchParams(searchParams, { replace: true });
      }
      onBound();
    } else {
      posthog.capture('referral_bind_failed');
    }
  };

  // Already bound (from /me) — or just bound this session before /me refreshed.
  // One referrer per wallet, forever: show the binding, never the input.
  if (referredBy || bound) {
    return (
      <div className="flex flex-col">
        <PanelHeader icon={Gift} title="Referred by" />
        {referredBy ? (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-1">
              <Label>Applied code</Label>
              <code className="font-mono text-sm font-semibold tracking-wider text-rock">
                {referredBy.code.toUpperCase()}
              </code>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-white/40">Referrer</span>
              <span className="font-mono text-xs text-white/60">
                {shortWallet(referredBy.referrer_wallet)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-white/40">Applied</span>
              <span className="font-mono text-xs text-white/60">
                {formatDate(referredBy.bound_at)}
              </span>
            </div>
            <p className="flex items-start gap-2 border-t border-outline pt-3 text-[11px] leading-relaxed text-white/40">
              <Check className="mt-0.5 size-3.5 shrink-0 text-white/50" />
              Your referrer earns a share of your taker volume. A wallet can only be referred once.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 p-4">
            <Check className="mt-0.5 size-4 shrink-0 text-white/60" />
            <p className="text-xs leading-relaxed text-white/55">
              Code applied — your referrer now earns on your trades.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <PanelHeader icon={Gift} title="Have a referral code?" />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-[11px] leading-relaxed text-white/45">
          Apply a friend's code any time — they'll earn on the volume you trade from here on. It
          links your wallet to them permanently, so you can only do this once.
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
            className="h-9 text-sm uppercase placeholder:normal-case"
            onKeyDown={e => {
              if (e.key === 'Enter' && !binding && code.trim()) {
                e.preventDefault();
                void handleBind();
              }
            }}
          />
          <Button
            size="sm"
            className="h-9 shrink-0 gap-1.5 px-3"
            disabled={binding || !code.trim()}
            onClick={handleBind}
          >
            {binding ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Apply
          </Button>
        </div>
        {fromLink && (
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-white/40">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-white/40" />
            You followed a referral link. Applying this code permanently links your wallet to this
            referrer — you can only do it once.
          </p>
        )}
      </div>
    </div>
  );
}
