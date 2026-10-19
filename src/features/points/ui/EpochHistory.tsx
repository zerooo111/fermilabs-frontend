/**
 * One row per epoch the wallet earned in, newest first, with each category's
 * points. On small screens the category columns collapse into the total.
 */
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import type { PointsAccountEpoch, PointsEpoch } from '../api/pointsClient';
import { CATEGORY_LABELS, CATEGORY_ORDER, epochLabel, epochRange, points } from '../model/format';
import { usePointsAccountEpochs, usePointsEpochs } from '../model/usePoints';
import { Bone, Notice, StatusChip } from './primitives';

export function EpochHistory({ wallet }: { wallet: string }) {
  const history = usePointsAccountEpochs(wallet);
  const { data: epochs } = usePointsEpochs();

  if (history.isPending) return <Bone className="h-32" />;
  if (history.isError) return <Notice title="Couldn't load epoch history." />;
  if (history.data.length === 0) {
    return (
      <Notice title="No epochs yet">Points show here per epoch once they're published.</Notice>
    );
  }

  const meta = new Map<number, PointsEpoch>(epochs?.map(e => [e.epoch, e]));
  const rows: PointsAccountEpoch[] = [...history.data].reverse();
  // Only show the categories this wallet has points in.
  const cats = CATEGORY_ORDER.filter(c => rows.some(r => r.by_category[c] !== 0));

  return (
    <Table containerClassName="border-y border-rock/15">
      <TableHeader className="bg-transparent">
        <TableRow className="border-rock/15 hover:bg-transparent">
          <TableHead className="text-rock/50">Epoch</TableHead>
          <TableHead className="text-rock/50">Status</TableHead>
          {cats.map(c => (
            <TableHead key={c} className="text-right text-rock/50 max-md:hidden">
              {CATEGORY_LABELS[c]}
            </TableHead>
          ))}
          <TableHead className="text-right text-rock/50">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(r => {
          const m = meta.get(r.epoch);
          return (
            <TableRow key={r.epoch} className="border-rock/10 hover:bg-white/5">
              <TableCell>
                <span className="block text-rock">
                  {epochLabel(m ?? { epoch: r.epoch, name: null })}
                </span>
                {m && <span className="block text-xs text-rock/50">{epochRange(m)}</span>}
              </TableCell>
              <TableCell>
                <StatusChip status={r.status} />
              </TableCell>
              {cats.map(c => (
                <TableCell
                  key={c}
                  className="text-right font-mono tabular-nums text-rock/75 max-md:hidden"
                >
                  {r.by_category[c] ? points(r.by_category[c]) : '—'}
                </TableCell>
              ))}
              <TableCell className="text-right font-mono tabular-nums">{points(r.total)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
