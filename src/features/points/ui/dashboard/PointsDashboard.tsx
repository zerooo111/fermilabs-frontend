/**
 * The connected wallet's points dashboard (/dashboard/points), laid out as one
 * ruled sheet: a score row, then tabs (claim, history, earn more) beside a
 * column with the skill graph and epochs. Only a signed-in wallet sees it; the
 * public, read-only checker is /points. No invite is needed: a wallet without
 * access signs in for points only and can claim, but not trade.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtomValue, useSetAtom } from 'jotai';
import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import { DitherRidge } from '@/shared/ui/dither-ridge';
import { Eyebrow, Panel } from '@/shared/ui/panel';
import { landingHref } from '@/shared/lib/domains';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import {
  accessSessionAtom,
  gateLoadingAtom,
  pointsSessionAtom,
  signInForPoints,
} from '@/features/access-gate';
import { ConnectWallet } from '@/features/wallet-connect';
import type { PointsEpoch } from '../../api/pointsClient';
import {
  usePointsAccount,
  usePointsAccountEpochs,
  usePointsActivity,
  usePointsEpochs,
} from '../../model/usePoints';
import { points, walletPointsPath } from '../../model/format';
import { useAllEntries } from '../../model/useAllEntries';
import { PixelAlien } from '../PixelAlien';
import { ScoreCount } from '../ScoreCount';
import { ClaimTab } from './ClaimTab';
import { EarnTab, RulesLink } from './EarnTab';
import { Empty } from './Empty';
import { HistoryTab } from './HistoryTab';
import { Rail } from './Rail';
import { Tile } from './primitives';

function Header({ wallet }: { wallet?: string }) {
  return (
    <header className="relative flex min-h-28 flex-col justify-end gap-2 px-1">
      <DitherRidge
        seed="points"
        density={0.35}
        className="pointer-events-none absolute right-0 bottom-0 hidden h-28 w-1/2 text-lichen opacity-35 [mask-image:linear-gradient(to_right,transparent,black_45%)] md:block"
      />
      <Eyebrow className="relative">ALIEN points · Season 1</Eyebrow>
      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-4xl leading-none font-light tracking-[-0.02em] text-rock md:text-5xl">
          Your points
        </h1>
        <div className="flex items-center gap-4">
          {wallet && (
            <a
              href={landingHref(walletPointsPath(wallet))}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-rock/60 hover:text-rock"
            >
              Public page
              <ArrowUpRight className="size-3.5" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </div>
      </div>
      <p className="relative max-w-xl text-sm text-rock/70">
        Everything your wallet has earned, what's ready to claim, and where it came from.
      </p>
    </header>
  );
}

/** The centred prompt shown instead of the dashboard. */
function Prompt({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <Panel>
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <div className="w-12 opacity-80" aria-hidden>
          <PixelAlien wallet="fermi" className="w-full" />
        </div>
        <h2 className="text-base font-medium text-rock">{title}</h2>
        <p className="max-w-sm text-sm leading-relaxed text-rock/65">{body}</p>
        {children && <div className="mt-2">{children}</div>}
      </div>
    </Panel>
  );
}

/**
 * Signs the wallet in when it has no session: a wallet with access gets its
 * trading session back, any other wallet a points-only one.
 */
function SignIn({ wallet }: { wallet: string }) {
  const { signMessage } = useWallet();
  const setSessions = useSetAtom(accessSessionAtom);
  const setPointsSessions = useSetAtom(pointsSessionAtom);
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');

  const signIn = async () => {
    if (!signMessage) return;
    setState('busy');
    try {
      const { scope, session } = await signInForPoints(wallet, signMessage);
      const set = scope === 'access' ? setSessions : setPointsSessions;
      set(prev => ({ ...prev, [wallet]: session }));
    } catch {
      setState('failed');
    }
  };

  return (
    <Prompt
      title="Sign in to see your points"
      body="Sign a message with your wallet to prove it's yours. It doesn't cost anything."
    >
      <Button onClick={signIn} disabled={state === 'busy' || !signMessage}>
        {state === 'busy' ? 'Confirm in your wallet…' : 'Sign in'}
      </Button>
      {state === 'failed' && (
        <p className="mt-3 text-xs text-danger">Sign-in didn't go through. Try again.</p>
      )}
    </Prompt>
  );
}

type Tab = 'claim' | 'history' | 'earn';

/** A count beside a tab label; amber when there is something to do. */
function Count({ n, hot }: { n: number; hot?: boolean }) {
  return (
    <span
      className={cn(
        'min-w-4 px-1 font-mono text-[10px] tabular-nums',
        hot ? 'bg-amber-200 text-dark-forest' : 'text-rock/50'
      )}
    >
      {n}
    </span>
  );
}

function Dashboard({ wallet }: { wallet: string }) {
  const account = usePointsAccount(wallet);
  const accountEpochs = usePointsAccountEpochs(wallet);
  const { data: epochList } = usePointsEpochs();
  const activity = usePointsActivity(wallet);
  const entries = useAllEntries(activity);
  const [tab, setTab] = useState<Tab | null>(null);

  const epochs = useMemo(
    () => new Map<number, PointsEpoch>((epochList ?? []).map(e => [e.epoch, e])),
    [epochList]
  );
  const claimable = entries.filter(e => e.claim_status === 'claimable');
  const a = account.data;
  const loading = account.isPending;
  const unclaimed = a ? a.claims.claimable + a.claims.granted : 0;
  // Open on what needs doing: claim when there's something to claim.
  const current: Tab = tab ?? (claimable.length > 0 ? 'claim' : 'history');

  return (
    <section className="border border-outline">
      {/* Score row: cells sit on a 1px grid gap over the rule colour, so the
          hairlines hold at any column count. */}
      <div className="grid grid-cols-2 gap-px border-b border-outline bg-outline lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
        <div className="col-span-2 flex items-center gap-4 bg-background px-4 py-4 lg:col-span-1">
          <div className="w-12 shrink-0" aria-hidden>
            <PixelAlien wallet={wallet} className="w-full" />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Eyebrow>Total points</Eyebrow>
            <ScoreCount
              value={a ? a.total : 0}
              className="font-mono text-4xl leading-none font-semibold tracking-[-0.04em] text-rock tabular-nums"
            />
          </div>
        </div>
        <Tile
          className="bg-background"
          label="Claimed"
          loading={loading}
          value={a ? points(a.claims.claimed) : '—'}
        />
        <Tile
          className="bg-background"
          label="Unclaimed"
          loading={loading}
          value={a ? points(unclaimed) : '—'}
          valueClassName={unclaimed > 0 ? 'text-amber-200' : undefined}
          hint={a && a.claims.granted > 0 ? `${points(a.claims.granted)} pending` : undefined}
        />
        <Tile
          className="col-span-2 bg-background sm:col-span-1 lg:col-span-1"
          label="Rank"
          loading={loading}
          value={a?.rank ? `#${a.rank}` : '—'}
          hint={
            a?.rank
              ? `of ${a.ranked} · top ${Math.max(1, Math.ceil((a.rank / a.ranked) * 100))}%`
              : 'no points yet'
          }
        />
      </div>

      <div className="grid divide-outline lg:grid-cols-[minmax(0,1fr)_22rem] lg:divide-x">
        <Tabs value={current} onValueChange={v => setTab(v as Tab)} className="min-w-0">
          <div className="flex h-11 items-stretch justify-between border-b border-outline bg-card pr-4">
            <TabsList className="h-full">
              <TabsTrigger value="claim" className="px-4">
                Claim <Count n={claimable.length} hot={claimable.length > 0} />
              </TabsTrigger>
              <TabsTrigger value="history" className="px-4">
                History <Count n={entries.length} />
              </TabsTrigger>
              <TabsTrigger value="earn" className="px-4">
                Earn more
              </TabsTrigger>
            </TabsList>
            <RulesLink className="max-sm:hidden" />
          </div>
          {activity.isPending ? (
            <Empty title="Loading…" />
          ) : (
            <>
              <TabsContent value="claim">
                <ClaimTab entries={claimable} epochs={epochs} />
              </TabsContent>
              <TabsContent value="history">
                <HistoryTab entries={entries} epochs={epochs} />
              </TabsContent>
            </>
          )}
          <TabsContent value="earn">
            <EarnTab account={a} />
          </TabsContent>
        </Tabs>
        <div className="border-t border-outline lg:border-t-0">
          <Rail account={a} rows={accountEpochs.data} epochs={epochs} />
        </div>
      </div>
    </section>
  );
}

export function PointsDashboard() {
  const { publicKey, connecting } = useWallet();
  const sessions = useAtomValue(accessSessionAtom);
  const pointsSessions = useAtomValue(pointsSessionAtom);
  const gateLoading = useAtomValue(gateLoadingAtom);
  const wallet = publicKey?.toBase58();
  const live = (s?: { expiresAt: number }) =>
    !!s && s.expiresAt - 5 * 60 > Math.floor(Date.now() / 1000);
  const signedIn = !!wallet && (live(sessions[wallet]) || live(pointsSessions[wallet]));

  let body: ReactNode;
  if (!wallet) {
    body = (
      <Prompt
        title="Connect your wallet"
        body="Connect your wallet to see your points, claim them and follow every entry. No invite needed."
      >
        {!connecting && <ConnectWallet />}
      </Prompt>
    );
  } else if (signedIn) {
    body = <Dashboard wallet={wallet} />;
  } else if (gateLoading) {
    body = <Prompt title="Checking your wallet…" body="Approve the sign-in in your wallet." />;
  } else {
    body = <SignIn wallet={wallet} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <Header wallet={signedIn ? wallet : undefined} />
      {body}
    </div>
  );
}
