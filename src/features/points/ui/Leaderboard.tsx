/**
 * The points leaderboard on the public checker: every wallet ranked by
 * points, filtered to one campaign or all of them, a page at a time. The
 * board and page live in the URL (`?board=&page=`), so a link opens the same
 * view. `me` (the checked or connected wallet) is highlighted, and "My rank"
 * pages to it.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';
import { usePointsLeaderboard } from '../model/usePoints';
import { points, shortAddress, walletPointsPath } from '../model/format';
import { PixelAlien } from './PixelAlien';
import { Bone, Notice } from './primitives';

const PAGE = 25;

/** Campaigns are `external_id` prefixes on the gateway. */
const BOARDS = [
  { id: 'all', label: 'All', campaign: undefined },
  { id: 'mev', label: 'MEV victims', campaign: 'bonus:mev' },
  { id: 'testers', label: 'Early testers', campaign: 'bonus:early-beta' },
  { id: 'signups', label: 'Beta sign-ups', campaign: 'bonus:beta-signup' },
] as const;

type BoardId = (typeof BOARDS)[number]['id'];

const PILL =
  'h-9 border px-3 text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40';
const PILL_OFF = 'border-rock/20 text-rock/70 hover:border-rock/40 hover:text-rock';
const PILL_ON = 'border-amber-200 bg-amber-200 text-dark-forest';

function PageButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(PILL, PILL_OFF, 'min-w-9 font-mono')}
    >
      {children}
    </button>
  );
}

export function Leaderboard({ me }: { me?: string }) {
  const [params, setParams] = useSearchParams();
  const boardId: BoardId = BOARDS.some(b => b.id === params.get('board'))
    ? (params.get('board') as BoardId)
    : 'all';
  const board = BOARDS.find(b => b.id === boardId)!;
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  const query = usePointsLeaderboard({
    campaign: board.campaign,
    wallet: me,
    limit: PAGE,
    offset: (page - 1) * PAGE,
  });
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;
  const mine = data?.me?.position ? data.me : null;

  const go = (next: { board?: BoardId; page?: number }) => {
    setParams(
      prev => {
        const p = new URLSearchParams(prev);
        p.set('tab', 'leaderboard');
        if (next.board) p.set('board', next.board);
        if (next.page && next.page > 1) p.set('page', String(next.page));
        else p.delete('page');
        return p;
      },
      { replace: true }
    );
  };

  // "My rank" pages to the wallet, then scrolls its row into view once drawn.
  const myRow = useRef<HTMLLIElement>(null);
  const [jumping, setJumping] = useState(false);
  useEffect(() => {
    if (!jumping || query.isPlaceholderData || !myRow.current) return;
    myRow.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setJumping(false);
  }, [jumping, query.isPlaceholderData, data]);

  const jumpToMe = () => {
    if (!mine?.position) return;
    go({ board: boardId, page: Math.ceil(mine.position / PAGE) });
    setJumping(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Leaderboard" className="flex flex-wrap gap-2">
          {BOARDS.map(b => (
            <button
              key={b.id}
              type="button"
              aria-pressed={b.id === boardId}
              onClick={() => go({ board: b.id, page: 1 })}
              className={cn(PILL, b.id === boardId ? PILL_ON : PILL_OFF)}
            >
              {b.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={jumpToMe}
          disabled={!mine}
          className={cn(PILL, PILL_OFF, 'self-start lg:self-auto')}
        >
          My rank
        </button>
      </div>

      {/* Where the checked or connected wallet stands on this board */}
      <p className="text-sm text-rock/60">
        {!me ? (
          'Check an address above or connect a wallet to see your rank.'
        ) : !data ? (
          <Bone className="h-4 w-56" />
        ) : mine?.rank ? (
          <>
            <span className="font-mono text-rock">{shortAddress(me)}</span> is{' '}
            <span className="font-mono text-amber-200">#{points(mine.rank)}</span> of{' '}
            <span className="font-mono">{points(data.total)}</span> with{' '}
            <span className="font-mono text-rock">{points(mine.points)}</span> points.
          </>
        ) : (
          <>
            <span className="font-mono text-rock">{shortAddress(me)}</span> isn't on this board.
          </>
        )}
      </p>

      {query.isError ? (
        <Notice title="Couldn't load the leaderboard.">Try again in a minute.</Notice>
      ) : !data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Bone key={i} className="h-10" />
          ))}
        </div>
      ) : data.rows.length === 0 ? (
        <Notice title="No one is on this board yet." />
      ) : (
        <div className={cn('transition-opacity', query.isPlaceholderData && 'opacity-60')}>
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] gap-4 border-b border-rock/15 pb-2 text-xs tracking-[0.2em] text-rock/50 uppercase">
            <span>Rank</span>
            <span>Wallet</span>
            <span className="text-right">Points</span>
          </div>
          <ol>
            {data.rows.map(r => {
              const isMe = r.wallet === me;
              return (
                <li
                  key={r.wallet}
                  ref={isMe ? myRow : undefined}
                  className={cn(
                    'grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-dashed border-rock/15 py-2.5',
                    isMe && 'bg-amber-200/10'
                  )}
                >
                  <span className="font-mono text-rock/80 tabular-nums">#{points(r.rank)}</span>
                  <Link
                    to={walletPointsPath(r.wallet)}
                    className="flex min-w-0 items-center gap-3 text-rock/85 hover:text-rock"
                  >
                    <PixelAlien wallet={r.wallet} className="w-6 shrink-0" />
                    <span className="truncate font-mono text-sm">
                      <span className="md:hidden">{shortAddress(r.wallet)}</span>
                      <span className="max-md:hidden">{r.wallet}</span>
                    </span>
                    {isMe && (
                      <span className="shrink-0 border border-amber-200/60 px-1.5 text-[10px] tracking-[0.15em] text-amber-200 uppercase">
                        You
                      </span>
                    )}
                  </Link>
                  <span className="text-right font-mono text-rock tabular-nums">
                    {points(r.points)}
                  </span>
                </li>
              );
            })}
          </ol>

          <nav
            aria-label="Leaderboard pages"
            className="mt-6 flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-rock/55">
              Page <span className="font-mono text-rock">{points(page)}</span> of{' '}
              <span className="font-mono">{points(pages)}</span> ·{' '}
              <span className="font-mono">{points(data.total)}</span> wallets
            </p>
            <div className="flex gap-2">
              <PageButton label="First page" onClick={() => go({ page: 1 })} disabled={page <= 1}>
                «
              </PageButton>
              <PageButton
                label="Previous page"
                onClick={() => go({ page: page - 1 })}
                disabled={page <= 1}
              >
                ‹
              </PageButton>
              <PageButton
                label="Next page"
                onClick={() => go({ page: page + 1 })}
                disabled={page >= pages}
              >
                ›
              </PageButton>
              <PageButton
                label="Last page"
                onClick={() => go({ page: pages })}
                disabled={page >= pages}
              >
                »
              </PageButton>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
