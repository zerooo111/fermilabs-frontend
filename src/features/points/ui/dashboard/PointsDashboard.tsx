/**
 * The connected wallet's points dashboard (/dashboard/points): headline
 * numbers, what it can claim (one by one or all at once), its full history and
 * a breakdown by category and epoch. Only a signed-in wallet sees it; the
 * public, read-only checker is /points.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Button } from '@/shared/ui/button';
import { DitherRidge } from '@/shared/ui/dither-ridge';
import { Eyebrow, Panel } from '@/shared/ui/panel';
import { landingHref } from '@/shared/lib/domains';
import {
  AccessGateError,
  accessSessionAtom,
  gateLoadingAtom,
  gateOpenAtom,
  signInSession,
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
import { ClaimablePanel } from './ClaimablePanel';
import { HistoryPanel } from './HistoryPanel';
import { CategoryPanel, EpochsPanel, HowClaimingWorks } from './SidePanels';
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

/** Signs the wallet in when it has no session (expired, or the prompt was dismissed). */
function SignIn({ wallet }: { wallet: string }) {
  const { signMessage } = useWallet();
  const [, setSessions] = useAtom(accessSessionAtom);
  const openGate = useSetAtom(gateOpenAtom);
  const [state, setState] = useState<'idle' | 'busy' | 'no-access' | 'failed'>('idle');

  const signIn = async () => {
    if (!signMessage) return;
    setState('busy');
    try {
      const session = await signInSession(wallet, signMessage);
      setSessions(prev => ({ ...prev, [wallet]: session }));
    } catch (e) {
      setState(
        e instanceof AccessGateError && e.code === 'wallet_not_whitelisted' ? 'no-access' : 'failed'
      );
    }
  };

  if (state === 'no-access') {
    return (
      <Prompt
        title="This wallet doesn't have access yet"
        body="Redeem an invite to use Fermi, then come back to see and claim your points."
      >
        <Button onClick={() => openGate(true)}>Get access</Button>
      </Prompt>
    );
  }
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

function Dashboard({ wallet }: { wallet: string }) {
  const account = usePointsAccount(wallet);
  const accountEpochs = usePointsAccountEpochs(wallet);
  const { data: epochList } = usePointsEpochs();
  const activity = usePointsActivity(wallet);
  const entries = useAllEntries(activity);

  const epochs = useMemo(
    () => new Map<number, PointsEpoch>((epochList ?? []).map(e => [e.epoch, e])),
    [epochList]
  );
  const claimable = entries.filter(e => e.claim_status === 'claimable');
  const a = account.data;
  const loading = account.isPending;
  const entriesLoading = activity.isPending;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 divide-outline border border-outline max-lg:[&>*:nth-child(n+3)]:border-t max-lg:[&>*:nth-child(odd)]:border-r lg:grid-cols-4 lg:divide-x">
        <Tile label="Total points" loading={loading} value={a ? points(a.total) : '—'} />
        <Tile
          label="Rank"
          loading={loading}
          value={a?.rank ? `#${a.rank}` : '—'}
          hint={
            a?.rank
              ? `of ${a.ranked} · top ${Math.max(1, Math.ceil((a.rank / a.ranked) * 100))}%`
              : 'claim points to rank'
          }
        />
        <Tile
          label="Ready to claim"
          loading={loading}
          value={a ? points(a.claims.claimable) : '—'}
          valueClassName={a && a.claims.claimable > 0 ? 'text-amber-200' : undefined}
        />
        <Tile
          label="Pending"
          loading={loading}
          value={a ? points(a.claims.granted) : '—'}
          hint={a && a.claims.expired > 0 ? `${points(a.claims.expired)} expired` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <ClaimablePanel entries={claimable} epochs={epochs} loading={entriesLoading} />
          <HistoryPanel entries={entries} epochs={epochs} loading={entriesLoading} />
        </div>
        <div className="flex flex-col gap-4">
          <CategoryPanel account={a} />
          <EpochsPanel rows={accountEpochs.data} epochs={epochs} />
          <HowClaimingWorks />
        </div>
      </div>
    </div>
  );
}

export function PointsDashboard() {
  const { publicKey, connecting } = useWallet();
  const sessions = useAtomValue(accessSessionAtom);
  const gateLoading = useAtomValue(gateLoadingAtom);
  const wallet = publicKey?.toBase58();
  const session = wallet ? sessions[wallet] : undefined;
  const signedIn = !!session && session.expiresAt - 5 * 60 > Math.floor(Date.now() / 1000);

  let body: ReactNode;
  if (!wallet) {
    body = (
      <Prompt
        title="Connect your wallet"
        body="Connect the wallet you trade with to see your points, claim bonuses and follow every entry."
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
