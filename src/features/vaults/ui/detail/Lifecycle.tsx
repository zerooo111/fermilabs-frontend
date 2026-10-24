/**
 * Where the vault is in its life: pre-deposit → live → closed. Each phase
 * says what a deposit does in it, so "pre-deposit" isn't a mystery word.
 */
import { cn } from '@/lib/utils';

import type { Vault } from '../../api/vaultsClient';
import { duration, formatDate } from '../../model/format';
import { Eyebrow } from '../primitives';

type Step = { key: string; title: string; body: string; at: number | null };

function steps(v: Vault): Step[] {
  const epoch = duration(v.epoch_duration_s);
  return [
    {
      key: 'pre-deposit',
      title: 'Pre-deposit',
      body: 'Deposits wait in escrow and can be withdrawn any time. They become shares at launch.',
      at: v.created_at_ms,
    },
    {
      key: 'live',
      title: 'Live',
      body: `Provides liquidity. Deposits and withdrawals settle at each epoch close (every ${epoch}).`,
      at: v.live_started_at_ms,
    },
    {
      key: 'closed',
      title: v.mode === 'unwind' ? 'Unwinding' : 'Closed',
      body:
        v.mode === 'unwind'
          ? 'Positions are being wound down. New requests wait; open deposits can be refunded.'
          : 'Holders redeem shares at the final price.',
      at: null,
    },
  ];
}

const ORDER: Record<Vault['mode'], number> = { 'pre-deposit': 0, live: 1, unwind: 2, closed: 2 };

export function Lifecycle({ vault: v }: { vault: Vault }) {
  const current = ORDER[v.mode];
  return (
    <div className="flex flex-col gap-3 border-t border-outline px-4 py-3.5">
      <Eyebrow>Lifecycle</Eyebrow>
      <ol className="flex flex-col">
        {steps(v).map((s, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <li key={s.key} className="relative flex gap-3 pb-3 last:pb-0">
              {/* Rail between steps: solid once passed, dotted ahead. */}
              {i < 2 && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-3 bottom-0 left-[3px] w-px',
                    done ? 'bg-lichen/50' : 'border-l border-dashed border-rock/20'
                  )}
                />
              )}
              <span
                aria-hidden
                className={cn(
                  'relative mt-1 size-[7px] shrink-0',
                  done && 'bg-lichen/70',
                  now &&
                    'bg-amber-200 shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-amber-200)_20%,transparent)]',
                  !done && !now && 'border border-rock/30'
                )}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={cn(
                      'text-xs',
                      now ? 'text-rock' : done ? 'text-rock/75' : 'text-rock/60'
                    )}
                  >
                    {s.title}
                    {now && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-200">
                        Now
                      </span>
                    )}
                  </span>
                  {s.at && (done || now) && (
                    <span className="font-mono text-[11px] text-rock/60">
                      {formatDate(s.at / 1000)}
                    </span>
                  )}
                </div>
                {(now || !done) && <p className="text-xs leading-relaxed text-rock/60">{s.body}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
