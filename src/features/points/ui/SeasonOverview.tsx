/**
 * The season at a glance: the epoch that is accruing now, and every epoch
 * with its dates and status.
 */
import { useEffect, useState } from 'react';
import type { PointsEpoch } from '../api/pointsClient';
import { countdown, epochLabel, epochRange } from '../model/format';
import { usePointsEpochs } from '../model/usePoints';
import { Bone, Eyebrow, Notice, StatusChip } from './primitives';

/** Re-renders every minute so countdowns stay current. */
function useNow(stepMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), stepMs);
    return () => window.clearInterval(id);
  }, [stepMs]);
  return now;
}

/** The live epoch; otherwise the next upcoming one. */
function currentEpoch(epochs: PointsEpoch[]): PointsEpoch | undefined {
  return epochs.find(e => e.status === 'live') ?? epochs.find(e => e.status === 'upcoming');
}

export function SeasonOverview() {
  const { data: epochs, isPending, isError } = usePointsEpochs();
  const now = useNow();

  if (isPending) {
    return (
      <div className="grid gap-3">
        <Bone className="h-24" />
        <Bone className="h-40" />
      </div>
    );
  }
  if (isError) return <Notice title="Couldn't load the season. Try again shortly." />;
  if (epochs.length === 0) {
    return (
      <Notice title="No epochs published yet">
        Epoch dates appear here once the season schedule is live.
      </Notice>
    );
  }

  const current = currentEpoch(epochs);
  const finals = epochs.filter(e => e.status === 'final').length;
  const isLive = current?.status === 'live';
  const ends = current && (isLive ? current.ends_at_ms : current.starts_at_ms);

  return (
    <div className="grid gap-6">
      {current && (
        <div className="grid gap-px border border-rock/15 bg-rock/15 sm:grid-cols-3">
          <div className="bg-dark-forest p-5">
            <Eyebrow>{isLive ? 'Accruing now' : 'Next up'}</Eyebrow>
            <p className="mt-2 font-serif text-3xl font-light">{epochLabel(current)}</p>
            <p className="mt-1 text-sm text-rock/60">{epochRange(current)}</p>
          </div>
          <div className="bg-dark-forest p-5">
            <Eyebrow>{isLive ? 'Closes in' : 'Starts in'}</Eyebrow>
            <p className="mt-2 font-serif text-3xl font-light tabular-nums">
              {ends ? countdown(ends - now) : '—'}
            </p>
            <p className="mt-1 text-sm text-rock/60">Epochs close Sunday 00:00 UTC</p>
          </div>
          <div className="bg-dark-forest p-5">
            <Eyebrow>Final epochs</Eyebrow>
            <p className="mt-2 font-serif text-3xl font-light tabular-nums">
              {finals} <span className="text-rock/40">/ {epochs.length}</span>
            </p>
            <p className="mt-1 text-sm text-rock/60">Points are final 14 days after close</p>
          </div>
        </div>
      )}

      <div>
        <Eyebrow className="mb-3">Schedule</Eyebrow>
        <ul className="divide-y divide-rock/10 border-y border-rock/15">
          {epochs.map(e => (
            <li
              key={e.epoch}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
            >
              <span className="min-w-0">
                <span className="text-rock">{epochLabel(e)}</span>
                <span className="ml-3 text-sm text-rock/55">{epochRange(e)}</span>
              </span>
              <StatusChip status={e.status} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
