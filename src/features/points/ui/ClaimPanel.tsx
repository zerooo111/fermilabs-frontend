/**
 * Points waiting on the wallet: what it can claim now, and what is still
 * pending until its period closes. Only the wallet itself can claim, so a
 * visitor checking someone else's address sees the numbers without a button.
 */
import { useWallet } from '@solana/wallet-adapter-react';
import { useSetAtom } from 'jotai';
import { toast } from 'sonner';
import { AccessGateError, gateOpenAtom } from '@/features/access-gate';
import type { PointsAccount, PointsEntry } from '../api/pointsClient';
import { useClaimPoints } from '../model/usePoints';
import { CATEGORY_LABELS, points, shortAddress } from '../model/format';
import { Label } from './primitives';

const BUTTON =
  'h-12 shrink-0 bg-amber-200 px-5 font-medium text-dark-forest transition-colors duration-150 hover:bg-amber-100 disabled:cursor-wait disabled:opacity-70';

/** "Sign-up bonus and Early user bonus": the distinct sources, in order. */
function sources(entries: PointsEntry[]): string {
  const names = [...new Set(entries.map(e => e.description ?? CATEGORY_LABELS[e.category]))];
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

function rejected(e: unknown): boolean {
  return e instanceof Error && /reject|declin|cancel/i.test(e.message);
}

export function ClaimPanel({
  wallet,
  account,
  entries,
}: {
  wallet: string;
  account: PointsAccount;
  entries: PointsEntry[];
}) {
  const connected = useWallet().publicKey?.toBase58();
  const openGate = useSetAtom(gateOpenAtom);
  const claim = useClaimPoints();

  const claimable = account.claims.claimable;
  const pending = account.claims.granted;
  if (claimable <= 0 && pending <= 0) return null;

  const notWhitelisted =
    claim.error instanceof AccessGateError && claim.error.code === 'wallet_not_whitelisted';

  const onClaim = () =>
    claim.mutate(undefined, {
      onSuccess: r => {
        if (r.claimed > 0) toast.success(`${points(r.points)} points claimed`);
        else toast('Nothing left to claim.');
      },
      onError: e => {
        if (rejected(e) || (e instanceof AccessGateError && e.code === 'wallet_not_whitelisted'))
          return;
        toast.error("Couldn't claim. Try again in a minute.");
      },
    });

  let action;
  if (claimable <= 0) {
    action = null;
  } else if (!connected) {
    action = (
      <button type="button" onClick={() => openGate(true)} className={BUTTON}>
        Connect wallet to claim
      </button>
    );
  } else if (connected !== wallet) {
    action = (
      <p className="max-w-xs text-sm text-rock/60">
        You're connected as <span className="font-mono">{shortAddress(connected)}</span>. Connect{' '}
        <span className="font-mono">{shortAddress(wallet)}</span> to claim these.
      </p>
    );
  } else if (notWhitelisted) {
    action = (
      <div className="flex max-w-xs flex-col items-start gap-3">
        <p className="text-sm text-rock/60">This wallet needs Fermi access before it can claim.</p>
        <button type="button" onClick={() => openGate(true)} className={BUTTON}>
          Get access
        </button>
      </div>
    );
  } else {
    action = (
      <button type="button" onClick={onClaim} disabled={claim.isPending} className={BUTTON}>
        {claim.isPending ? 'Confirm in your wallet…' : `Claim ${points(claimable)} points`}
      </button>
    );
  }

  return (
    <section className="reg border-b border-rock/15 bg-amber-200/[0.04] px-5 py-8 md:px-10 md:py-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3">
          {claimable > 0 ? (
            <>
              <Label>Ready to claim</Label>
              <p className="font-mono text-5xl leading-none tracking-[-0.04em] text-amber-200 tabular-nums md:text-6xl">
                +{points(claimable)}
              </p>
              <p className="text-rock/70">
                {sources(entries.filter(e => e.claim_status === 'claimable'))}. Claim them to add
                them to your total.
              </p>
            </>
          ) : (
            <Label>Pending</Label>
          )}
          {pending > 0 && (
            <p className="flex items-start gap-2 text-sm text-rock/55">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-rock/40" aria-hidden />
              <span>
                <span className="font-mono text-rock/80">{points(pending)}</span> more pending. They
                become claimable when their period closes.
              </span>
            </p>
          )}
        </div>
        {action}
      </div>
    </section>
  );
}
