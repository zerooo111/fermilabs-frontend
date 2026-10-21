/**
 * One wallet's points, shown on the points page under the checker when the
 * URL has ?wallet=: two ruled rows, the score beside points over time, then
 * where they came from beside the latest activity. Public: the address comes
 * from the URL, so a link shows the same numbers to anyone.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy } from 'lucide-react';
import { XLogo } from '@phosphor-icons/react';
import axios from 'axios';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtom } from 'jotai';
import { gateOpenAtom } from '@/features/access-gate';
import { appHref, isLandingHost, landingHref } from '@/shared/lib/domains';
import { cn } from '@/shared/lib/utils';
import {
  ActivityList,
  Bone,
  Label,
  Notice,
  PixelAlien,
  PointsChart,
  ScoreCount,
  SkillGraph,
  isValidAddress,
  points,
  shortAddress,
  useAllEntries,
  usePointsAccount,
  usePointsActivity,
  usePointsEpochs,
  walletPointsPath,
  type PointsAccount,
} from '@/features/points';

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

const DASHBOARD = '/dashboard/points';
const CTA =
  'bg-amber-200 px-5 py-2.5 font-medium text-dark-forest transition-colors duration-150 hover:bg-amber-100';
const CTA_SECONDARY =
  'inline-flex items-center gap-2 border border-rock/25 px-5 py-2.5 font-medium text-rock transition-colors duration-150 hover:border-rock/50 hover:bg-rock/5';

/**
 * Sends the visitor to their points dashboard, where they claim. This page is
 * read-only. Without a wallet it opens the access gate first and goes on once
 * the wallet connects. On fermi.trade the dashboard is on app.fermi.trade, where
 * a connection made here doesn't carry over, so it links there and the
 * dashboard asks to connect.
 */
function ClaimButton({ wallet, claimable }: { wallet: string; claimable: number }) {
  const navigate = useNavigate();
  const connected = useWallet().publicKey?.toBase58();
  const [gateOpen, setGateOpen] = useAtom(gateOpenAtom);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!pending) return;
    if (connected) navigate(DASHBOARD);
    // Closing the gate without connecting cancels the trip.
    else if (!gateOpen) setPending(false);
  }, [pending, connected, gateOpen, navigate]);

  const label =
    connected === wallet && claimable > 0
      ? `Claim ${points(claimable)} points`
      : connected
        ? 'Go to your points dashboard'
        : 'Connect wallet to claim';

  if (isLandingHost) {
    return (
      <a href={appHref(DASHBOARD)} className={CTA}>
        {label}
      </a>
    );
  }
  const open = () => {
    if (connected) return navigate(DASHBOARD);
    setPending(true);
    setGateOpen(true);
  };
  return (
    <button type="button" onClick={open} className={CTA}>
      {label}
    </button>
  );
}

/**
 * Posts the wallet's score to X, linking back to this page for that wallet so
 * whoever clicks through sees the same numbers. The link always points at the
 * landing domain, where this page lives.
 */
function ShareOnX({ wallet, account }: { wallet: string; account: PointsAccount }) {
  const href = landingHref(walletPointsPath(wallet));
  const url = href.startsWith('http') ? href : `${window.location.origin}${href}`;
  const standing =
    account.rank !== null
      ? `, ranked #${account.rank.toLocaleString()} of ${account.ranked.toLocaleString()} (top ${topShare(account.rank, account.ranked)})`
      : '';
  const text = `I've got ${points(account.total)} ALIEN Points on @FermiLabs${standing}. Check yours:`;
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  return (
    <a href={intent} target="_blank" rel="noopener noreferrer" className={CTA_SECONDARY}>
      <XLogo weight="bold" className="size-4" aria-hidden />
      Share on X
    </a>
  );
}

const PAD = 'px-5 py-8 md:px-10 md:py-10';

/** A full-width band; on large screens its two cells sit side by side. */
function Row({ children }: { children: ReactNode }) {
  return (
    <section className="reg border-b border-rock/15">
      <div className="grid divide-y divide-dashed divide-rock/20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:divide-x lg:divide-y-0">
        {children}
      </div>
    </section>
  );
}

/** A single band, for loading and error states. */
function Band({ children }: { children: ReactNode }) {
  return <section className={`reg border-b border-rock/15 ${PAD}`}>{children}</section>;
}

function Results({ wallet }: { wallet: string }) {
  const account = usePointsAccount(wallet);
  const activity = usePointsActivity(wallet);
  const { data: epochs } = usePointsEpochs();
  // The chart needs every entry, so page through the activity.
  const entries = useAllEntries(activity);

  if (account.isPending) {
    return (
      <Band>
        <div className="grid gap-4">
          <Bone className="h-24 w-72" />
          <Bone className="h-48" />
        </div>
      </Band>
    );
  }
  if (account.isError) {
    const notDeployed = axios.isAxiosError(account.error) && account.error.response?.status === 404;
    return (
      <Band>
        <Notice title={notDeployed ? 'Points are not live yet.' : "Couldn't load points."}>
          Try again in a minute.
        </Notice>
      </Band>
    );
  }

  const a = account.data;
  // The total counts every point that hasn't expired, so the chart does too.
  const counted = entries.filter(e => e.claim_status !== 'expired');
  const unclaimed = a.claims.claimable + a.claims.granted;
  const startMs = Math.min(...(epochs ?? []).map(e => e.starts_at_ms), Date.now());

  // The wallet's alien beams in beside the score; key replays it per wallet.
  const alien = (
    <div key={wallet} className="points-alien w-14 shrink-0" aria-hidden>
      <PixelAlien wallet={wallet} className="w-full" />
    </div>
  );

  if (a.total === 0 && entries.length === 0) {
    return (
      <Band>
        <div className="flex items-center gap-6">
          {alien}
          <div className="flex flex-col gap-1">
            <CopyAddress address={wallet} />
            <p className="font-serif text-6xl leading-none font-light md:text-7xl">0</p>
            <p className="mt-2 text-rock/70">
              No points here yet. Pick a way to earn below to get on the board.
            </p>
          </div>
        </div>
      </Band>
    );
  }

  return (
    <>
      <Row>
        <div className={`flex flex-col gap-7 ${PAD}`}>
          {/* Who: the wallet's alien and address */}
          <div className="flex items-center gap-4">
            {alien}
            <div className="flex min-w-0 flex-col gap-1">
              <Label>Wallet</Label>
              <CopyAddress address={wallet} />
            </div>
          </div>

          {/* How much: the number this page is for, then how much of it is claimed */}
          <div>
            <Label className="mb-3">Total points</Label>
            <ScoreCount
              value={a.total}
              className="block font-mono text-[clamp(3.5rem,7vw,5.75rem)] leading-[0.9] font-normal tracking-[-0.06em] tabular-nums"
            />
          </div>

          <div className="-mt-2 flex flex-col gap-2">
            <dl className="grid grid-cols-2 divide-x divide-rock/15 border border-rock/15">
              <div className="px-4 py-3">
                <dt className="text-sm text-rock/55">Claimed</dt>
                <dd className="mt-1 font-mono text-2xl leading-none tracking-tight text-rock tabular-nums">
                  {points(a.claims.claimed)}
                </dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-sm text-rock/55">Unclaimed</dt>
                <dd
                  className={cn(
                    'mt-1 font-mono text-2xl leading-none tracking-tight tabular-nums',
                    unclaimed > 0 ? 'text-amber-200' : 'text-rock/40'
                  )}
                >
                  {points(unclaimed)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Where it stands */}
          {a.rank !== null && (
            <dl className="grid grid-cols-2 divide-x divide-rock/15 border border-rock/15">
              <div className="px-4 py-3">
                <dt className="text-sm text-rock/55">Rank</dt>
                <dd className="mt-1 text-sm text-rock/55">
                  <span className="mr-1.5 font-mono text-3xl leading-none tracking-tight text-rock">
                    #{a.rank}
                  </span>
                  of <span className="font-mono">{a.ranked}</span>
                </dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-sm text-rock/55">Standing</dt>
                <dd className="mt-1 text-sm text-rock/55">
                  Top
                  <span className="ml-1.5 font-mono text-3xl leading-none tracking-tight text-amber-200">
                    {topShare(a.rank, a.ranked)}
                  </span>
                </dd>
              </div>
            </dl>
          )}

          <div className="mt-1 flex flex-wrap gap-3">
            <ClaimButton wallet={wallet} claimable={a.claims.claimable} />
            <ShareOnX wallet={wallet} account={a} />
          </div>
        </div>
        <div className={`flex flex-col ${PAD}`}>
          <Label className="mb-4">Points over time</Label>
          {/* Grows to the row's height, which the score beside it sets. */}
          <div className="min-h-0 flex-1">
            <PointsChart entries={counted} startMs={startMs} />
          </div>
        </div>
      </Row>

      <Row>
        <div className={PAD}>
          <Label className="mb-2">Where they came from</Label>
          <SkillGraph account={a} />
        </div>
        <div className={PAD}>
          <Label className="mb-4">Latest activity</Label>
          {entries.length > 0 ? (
            <ActivityList entries={entries} />
          ) : (
            <p className="text-rock/60">Nothing yet.</p>
          )}
        </div>
      </Row>
    </>
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
      <Band>
        <Notice title="That isn't a Solana wallet address.">
          Check the address and try again.
        </Notice>
      </Band>
    );
  }
  return <Results wallet={wallet} />;
}
