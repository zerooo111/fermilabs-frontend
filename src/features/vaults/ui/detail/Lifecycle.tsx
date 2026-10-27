/**
 * Where the vault is in its life: pre-deposits → main pool (→ unwinding or
 * closed, shown only once the vault gets there). Each
 * phase says what a deposit does in it, so "pre-deposit" isn't a mystery word.
 * Graduation isn't a launch event of its own: pre-deposits move into the main
 * pool, so it's the main pool's start, with the announced date as an estimate.
 */
import { cn } from '@/lib/utils';

import type { Vault } from '../../api/vaultsClient';
import { duration, formatDate } from '../../model/format';
import { Eyebrow } from '../primitives';

type Step = {
  key: string;
  title: string;
  body: string;
  at: number | null;
  /** Shown ahead of time, marked as an estimate. */
  estimate?: number;
  /** An extra line under the step, e.g. what already runs during it. */
  note?: { title: string; body: string };
};

type Props = {
  vault: Vault;
  /** Announced graduation date (ms) while it isn't on chain. */
  graduationEstimateMs?: number;
  /** Whitelisted wallets' capital already trades during pre-deposit. */
  whitelistTrading?: boolean;
};

function steps({ vault: v, graduationEstimateMs, whitelistTrading }: Props): Step[] {
  const epoch = duration(v.epoch_duration_s);
  const list: Step[] = [
    {
      key: 'pre-deposit',
      title: 'Pre-deposits open',
      body: 'Your USDC waits in escrow and earns ALIEN pre-deposit points, with no trading P&L or fees. Withdraw it any time, in one transaction.',
      at: v.created_at_ms,
      note: whitelistTrading
        ? {
            title: 'Trading live for whitelisted wallets',
            body: 'The vault already quotes on Fermi mainnet with capital from whitelisted wallets, such as the team.',
          }
        : undefined,
    },
    {
      key: 'live',
      title: 'Main pool',
      body:
        v.mode === 'pre-deposit'
          ? `Pre-deposits graduate into it together, at one NAV per share and with no deposit fee. Deposits and withdrawals then settle at each epoch close (every ${epoch}).`
          : `Provides liquidity. Deposits and withdrawals settle at each epoch close (every ${epoch}).`,
      at: v.live_started_at_ms,
      estimate: graduationEstimateMs,
    },
  ];
  // The end of a vault's life isn't a step ahead of it: shown only once it's here.
  if (v.mode === 'unwind' || v.mode === 'closed') {
    list.push({
      key: 'closed',
      title: v.mode === 'unwind' ? 'Unwinding' : 'Closed',
      body:
        v.mode === 'unwind'
          ? 'Positions are being wound down. New requests wait; open deposits can be refunded.'
          : 'Holders redeem shares at the final price.',
      at: null,
    });
  }
  return list;
}

const ORDER: Record<Vault['mode'], number> = { 'pre-deposit': 0, live: 1, unwind: 2, closed: 2 };

export function Lifecycle(props: Props) {
  const current = ORDER[props.vault.mode];
  const list = steps(props);
  return (
    <div className="flex flex-col gap-3 border-t border-outline px-4 py-3.5">
      <Eyebrow>Lifecycle</Eyebrow>
      <ol className="flex flex-col">
        {list.map((s, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <li key={s.key} className="relative flex gap-3 pb-3 last:pb-0">
              {/* Rail between steps: solid once passed, dotted ahead. */}
              {i < list.length - 1 && (
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
                  {s.at && (done || now) ? (
                    <span className="font-mono text-[11px] text-rock/60">
                      {formatDate(s.at / 1000)}
                    </span>
                  ) : (
                    s.estimate &&
                    !done && (
                      <span className="font-mono text-[11px] text-rock/60">
                        Est. {formatDate(s.estimate / 1000)}
                      </span>
                    )
                  )}
                </div>
                {(now || !done) && <p className="text-xs leading-relaxed text-rock/60">{s.body}</p>}
                {now && s.note && (
                  <div className="mt-1.5 flex flex-col gap-0.5 border-l border-lichen/40 pl-2.5">
                    <span className="flex items-center gap-1.5 text-xs text-rock">
                      <span aria-hidden className="size-1.5 shrink-0 animate-pulse bg-lichen" />
                      {s.note.title}
                    </span>
                    <p className="text-xs leading-relaxed text-rock/60">{s.note.body}</p>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
