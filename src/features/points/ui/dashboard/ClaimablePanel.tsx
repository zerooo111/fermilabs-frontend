/**
 * The wallet's claimable entries, each with its own claim button, and a claim
 * all. Claimed points move into the total; the rest of the page refreshes from
 * the gateway once a claim settles.
 */
import { toast } from 'sonner';
import { useSetAtom } from 'jotai';
import { Button } from '@/shared/ui/button';
import { Panel } from '@/shared/ui/panel';
import { AccessGateError, gateOpenAtom } from '@/features/access-gate';
import type { PointsEntry, PointsEpoch } from '../../api/pointsClient';
import { useClaimPoints } from '../../model/usePoints';
import { CATEGORY_LABELS, dateUtc, epochName, points } from '../../model/format';
import { PanelBar } from './primitives';
import { Empty } from './Empty';

function rejected(e: unknown): boolean {
  return e instanceof Error && /reject|declin|cancel/i.test(e.message);
}

export function ClaimablePanel({
  entries,
  epochs,
  loading,
}: {
  entries: PointsEntry[];
  epochs: Map<number, PointsEpoch>;
  loading: boolean;
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

  return (
    <Panel>
      <PanelBar
        title="Ready to claim"
        count={entries.length}
        right={
          entries.length > 1 && (
            <Button size="sm" disabled={claim.isPending} onClick={() => run()}>
              {busy === 'all' ? 'Confirm in wallet…' : `Claim all · ${points(total)}`}
            </Button>
          )
        }
      />
      {loading ? (
        <Empty title="Loading…" />
      ) : entries.length === 0 ? (
        <Empty
          title="Nothing to claim right now"
          body="Bonuses land here ready to claim. Trading points become claimable when their epoch closes."
        />
      ) : (
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
                    {CATEGORY_LABELS[e.category]} · {epoch ? epochName(epoch) : `Epoch ${e.epoch}`}{' '}
                    · {dateUtc(e.occurred_at_ms)}
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
      )}
    </Panel>
  );
}
