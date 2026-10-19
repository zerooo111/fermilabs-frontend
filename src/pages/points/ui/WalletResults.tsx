/**
 * One wallet's points, shown on the points page under the checker when the
 * URL has ?wallet=: the score and rank, points over time, where they came
 * from and the latest activity. Public: the address comes from the URL, so a
 * link shows the same numbers to anyone.
 */
import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import axios from 'axios';
import {
  ActivityList,
  Bone,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  Notice,
  PixelAlien,
  PointsChart,
  ScoreCount,
  isValidAddress,
  points,
  shortAddress,
  usePointsAccount,
  usePointsActivity,
  usePointsEpochs,
} from '@/features/points';
import type { PointsAccount } from '@/features/points';

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(address).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };
  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={copy}
      title={address}
      aria-label={copied ? 'Copied' : 'Copy address'}
      className="inline-flex items-center gap-1.5 font-mono text-sm text-rock/60 transition-colors duration-150 hover:text-rock"
    >
      {shortAddress(address)}
      <Icon className="size-3.5" aria-hidden />
    </button>
  );
}

/** "top 2%": the share of ranked wallets at or above this rank, at least 1%. */
function topShare(rank: number, ranked: number): string {
  return `${Math.max(1, Math.ceil((rank / ranked) * 100))}%`;
}

function Breakdown({ account }: { account: PointsAccount }) {
  const rows = CATEGORY_ORDER.map(c => ({ c, v: account.by_category[c] ?? 0 })).filter(
    r => r.v > 0
  );
  const max = Math.max(1, ...rows.map(r => r.v));
  return (
    <ul className="grid gap-4">
      {rows.map(({ c, v }) => (
        <li key={c}>
          <p className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-rock/80">{CATEGORY_LABELS[c]}</span>
            <span className="tabular-nums text-rock">{points(v)}</span>
          </p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-rock/10">
            <div
              className="h-full rounded-full bg-lichen"
              style={{ width: `${(v / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-rock/10 bg-surface-base/60 p-5 md:p-6">
      <h3 className="mb-4 text-sm text-rock/60">{title}</h3>
      {children}
    </section>
  );
}

function Results({ wallet }: { wallet: string }) {
  const account = usePointsAccount(wallet);
  const activity = usePointsActivity(wallet);
  const { data: epochs } = usePointsEpochs();

  // The chart needs every entry, so page through the activity.
  useEffect(() => {
    if (activity.hasNextPage && !activity.isFetchingNextPage) void activity.fetchNextPage();
  }, [activity]);

  if (account.isPending) {
    return (
      <div className="grid gap-4">
        <Bone className="h-24 w-72 rounded-xl" />
        <Bone className="h-48 rounded-2xl" />
      </div>
    );
  }
  if (account.isError) {
    const notDeployed = axios.isAxiosError(account.error) && account.error.response?.status === 404;
    return (
      <Notice title={notDeployed ? 'Points are not live yet.' : "Couldn't load points."}>
        Try again in a minute.
      </Notice>
    );
  }

  const a = account.data;
  const entries = activity.data?.pages.flatMap(p => p.entries) ?? [];
  const settling = a.total - a.by_status.final;
  const startMs = Math.min(...(epochs ?? []).map(e => e.starts_at_ms), Date.now());

  // The wallet's alien beams in beside the score; key replays it per wallet.
  const alien = (
    <div key={wallet} className="points-alien w-24 shrink-0 md:w-32" aria-hidden>
      <PixelAlien wallet={wallet} className="w-full" />
    </div>
  );

  if (a.total === 0 && entries.length === 0) {
    return (
      <div className="flex items-center gap-6">
        {alien}
        <div className="flex flex-col gap-1">
          <CopyAddress address={wallet} />
          <p className="font-serif text-6xl leading-none font-light text-rock md:text-7xl">0</p>
          <p className="mt-2 text-rock/70">
            No points here yet. Pick a way to earn below to get on the board.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex items-center gap-6 py-2">
        {alien}
        <div className="flex min-w-0 flex-col gap-1">
          <CopyAddress address={wallet} />
          <p className="flex flex-wrap items-baseline gap-x-3">
            <ScoreCount
              value={a.total}
              className="font-serif text-7xl leading-none font-light tracking-[-0.02em] text-rock tabular-nums md:text-8xl"
            />
            <span className="text-xl text-rock/60">points</span>
          </p>
          {a.rank !== null && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-rock/80">
              <span className="rounded-full bg-amber-200 px-3 py-1 text-sm font-medium text-dark-forest">
                Rank {a.rank}
              </span>
              <span>
                of {a.ranked} wallets, top {topShare(a.rank, a.ranked)}
              </span>
            </p>
          )}
          {settling > 0 && (
            <p className="mt-2 text-sm text-rock/50">
              {settling === a.total ? 'All' : points(settling)} still an estimate. Points become
              final 14 days after the period closes.
            </p>
          )}
        </div>
      </div>

      <Card title="Points over time">
        <PointsChart entries={entries} startMs={startMs} />
      </Card>

      <Card title="Where they came from">
        <Breakdown account={a} />
      </Card>

      {entries.length > 0 && (
        <Card title="Latest activity">
          <ActivityList entries={entries} />
        </Card>
      )}
    </div>
  );
}

export function WalletResults({ wallet }: { wallet: string }) {
  const valid = isValidAddress(wallet);

  useEffect(() => {
    const prev = document.title;
    if (valid) document.title = `${shortAddress(wallet)} · ALIEN Points · Fermi Trade`;
    return () => {
      document.title = prev;
    };
  }, [wallet, valid]);

  if (!valid) {
    return (
      <Notice title="That isn't a Solana wallet address.">Check the address and try again.</Notice>
    );
  }
  return <Results wallet={wallet} />;
}
