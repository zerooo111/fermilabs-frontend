/**
 * OneClickToggle.tsx
 * Trade-ticket control for one-click trading: one wallet approval delegates
 * the account to this browser's session key; after that orders sign instantly.
 */
import { useState } from 'react';
import { CircleNotch, Lightning } from '@phosphor-icons/react';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { useOneClick } from '../model/useOneClick';

const isRejection = (err: unknown) =>
  /reject|denied|cancel/i.test(err instanceof Error ? err.message : String(err));

export function OneClickToggle() {
  const { status, enable, disable } = useOneClick();
  const [pending, setPending] = useState<Pending>(null);

  // Nothing to offer before a Fermi account exists or without WebCrypto Ed25519.
  if (status === 'unsupported' || status === 'no-account' || status === 'loading') return null;

  const run = async (action: 'enable' | 'disable') => {
    setPending(action);
    try {
      await (action === 'enable' ? enable() : disable());
      posthog.capture(action === 'enable' ? 'one_click_enabled' : 'one_click_disabled');
      toast.success(
        action === 'enable'
          ? 'One-click trading on. Orders now sign without wallet prompts.'
          : 'One-click trading off.'
      );
    } catch (err) {
      console.error(`One-click ${action} failed:`, err);
      if (!isRejection(err)) {
        toast.error(
          action === 'enable'
            ? 'Could not enable one-click trading. Please try again.'
            : 'Could not turn off one-click trading. Please try again.'
        );
      }
    } finally {
      setPending(null);
    }
  };

  return (
    <OneClickCard
      on={status === 'on'}
      pending={pending}
      onEnable={() => run('enable')}
      onDisable={() => run('disable')}
    />
  );
}

type Pending = 'enable' | 'disable' | null;

/** Stateless view: the off-state call to action and the on-state confirmation row. */
export function OneClickCard({
  on,
  pending,
  onEnable,
  onDisable,
}: {
  on: boolean;
  pending: Pending;
  onEnable: () => void;
  onDisable: () => void;
}) {
  // On: a slim confirmation row that stays out of the order button's way.
  if (on) {
    return (
      <div className="flex items-center justify-between gap-3 border border-amber-200/30 bg-amber-200/[0.06] px-3 py-2 text-xs">
        <span className="flex items-center gap-2 text-amber-200">
          <span className="relative flex size-1.5" aria-hidden>
            <span className="absolute inset-0 animate-ping bg-amber-200/70" />
            <span className="relative size-1.5 bg-amber-200" />
          </span>
          <Lightning size={13} weight="fill" />
          <span className="font-medium">One-click on</span>
        </span>
        <button
          type="button"
          disabled={pending !== null}
          onClick={onDisable}
          className="flex items-center gap-1.5 text-rock/55 underline-offset-4 transition-colors hover:text-rock hover:underline disabled:cursor-wait disabled:opacity-60"
        >
          {pending === 'disable' && <CircleNotch size={12} className="animate-spin" />}
          {pending === 'disable' ? 'Turning off…' : 'Turn off'}
        </button>
      </div>
    );
  }

  // Off: a call to action in the landing page's amber.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-3 border border-amber-200/40 bg-amber-200/[0.07] p-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center border border-amber-200/40 bg-amber-200/10 text-amber-200"
            aria-hidden
          >
            <Lightning size={18} weight="fill" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2 whitespace-nowrap text-sm font-medium text-rock">
              One-click trading
              {!pending && (
                <span className="border border-amber-200/50 px-1 font-mono text-[9px] uppercase leading-4 tracking-[0.14em] text-amber-200">
                  New
                </span>
              )}
            </span>
            {pending === 'enable' && (
              <span className="text-xs leading-snug text-amber-200">
                Confirm the transaction in your wallet.
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={pending !== null}
            onClick={onEnable}
            className="flex h-8 shrink-0 items-center gap-1.5 bg-amber-200 px-3 text-xs font-medium text-dark-forest transition-colors duration-150 hover:bg-amber-100 disabled:cursor-wait disabled:opacity-70"
          >
            {pending === 'enable' && <CircleNotch size={12} className="animate-spin" />}
            {pending === 'enable' ? 'Approving' : 'Enable'}
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        Approve once to enable auto signing.
      </TooltipContent>
    </Tooltip>
  );
}
