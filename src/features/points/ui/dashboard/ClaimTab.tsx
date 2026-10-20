/**
 * The wallet's claimable entries, each with its own claim button, and a claim
 * all. Claimed points move into the total; the rest of the page refreshes from
 * the gateway once a claim settles.
 */
import { toast } from 'sonner';
import { useSetAtom } from 'jotai';
import { Button } from '@/shared/ui/button';
import { AccessGateError, gateOpenAtom } from '@/features/access-gate';
import type { PointsEntry, PointsEpoch } from '../../api/pointsClient';
import { useClaimPoints } from '../../model/usePoints';
import { CATEGORY_LABELS, dateUtc, epochName, points } from '../../model/format';
import { Empty } from './Empty';

function rejected(e: unknown): boolean {
  return e instanceof Error && /reject|declin|cancel/i.test(e.message);
}

/** The lifecycle in one line, under the list. */
const HOW =
  'Bonuses arrive ready to claim. Trading points stay pending until their epoch closes. Only claimed points count toward your rank, and points left unclaimed can expire.';

export function ClaimTab({
  entries,
  epochs,
}: {
  entries: PointsEntry[];
  epochs: Map<number, PointsEpoch>;
}) {
  const claim = useClaimPoints();
  const openGate = useSetAtom(gateOpenAtom);
  const total = entries.reduce((sum, e) => sum + e.points, 0);
  // Which button is busy: undefined claims all, one id claims that entry.
  const busy = claim.isPending ? (claim.variables?.[0] ?? 'all') : null;

  const run = (ids?: number[]) =>
    claim.mutate(ids, {
      onSuccess: r => {
        if (r.claimed > 0) toast.success(`${points(r.points)} points claimed`);
        else toast('Nothing left to claim.');
      },
      onError: e => {
        if (rejected(e)) return;
        if (e instanceof AccessGateError && e.code === 'wallet_not_whitelisted') {
          toast.error('This wallet needs Fermi access before it can claim.', {
            action: { label: 'Get access', onClick: () => openGate(true) },
          });
          return;
        }
        toast.error("Couldn't claim. Try again in a minute.");
      },
    });

  if (entries.length === 0) {
    return <Empty title="Nothing to claim right now" body={HOW} />;
  }

  return (
    <div>
      {entries.length > 1 && (
        <div className="flex items-center justify-between gap-4 border-b border-outline px-4 py-3">
          <p className="text-sm text-rock/70">
            <span className="font-mono text-amber-200 tabular-nums">{points(total)}</span> points
            across {entries.length} rewards
          </p>
          <Button size="sm" disabled={claim.isPending} onClick={() => run()}>
            {busy === 'all' ? 'Confirm in wallet…' : 'Claim all'}
          </Button>
        </div>
      )}
      <ul className="divide-y divide-outline">
        {entries.map(e => {
          const epoch = epochs.get(e.epoch);
          return (
            <li key={e.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-rock">
                  {e.description ?? CATEGORY_LABELS[e.category]}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-rock/55">
                  {CATEGORY_LABELS[e.category]} · {epoch ? epochName(epoch) : `Epoch ${e.epoch}`} ·{' '}
                  {dateUtc(e.occurred_at_ms)}
                </p>
              </div>
              <span className="font-mono text-base tabular-nums text-amber-200">
                +{points(e.points)}
              </span>
              <Button
                size="sm"
                variant={entries.length > 1 ? 'outline' : 'default'}
                disabled={claim.isPending}
                onClick={() => run([e.id])}
                className="w-24"
              >
                {busy === e.id ? 'Confirm…' : 'Claim'}
              </Button>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-outline px-4 py-3 text-xs leading-relaxed text-rock/50">
        {HOW}
      </p>
    </div>
  );
}
