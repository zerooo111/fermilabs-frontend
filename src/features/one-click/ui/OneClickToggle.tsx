/**
 * OneClickToggle.tsx
 * Trade-ticket control for one-click trading: one wallet approval delegates
 * the account to this browser's session key; after that orders sign instantly.
 */
import { useState } from 'react';
import { CircleNotch, Lightning } from '@phosphor-icons/react';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { useOneClick } from '../model/useOneClick';

const isRejection = (err: unknown) =>
  /reject|denied|cancel/i.test(err instanceof Error ? err.message : String(err));

export function OneClickToggle() {
  const { status, enable, disable } = useOneClick();
  const [pending, setPending] = useState<'enable' | 'disable' | null>(null);

  // Nothing to offer before a Fermi account exists or without WebCrypto Ed25519.
  if (status === 'unsupported' || status === 'no-account' || status === 'loading') return null;

  const on = status === 'on';

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
    <div
      className={cn(
        'flex items-center justify-between gap-3 border px-2.5 py-2 text-xs',
        on ? 'border-lichen/30 bg-lichen/5' : 'border-outline/60'
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex min-w-0 cursor-help items-center gap-2">
            <Lightning
              size={14}
              weight={on ? 'fill' : 'regular'}
              className={on ? 'text-lichen' : 'text-rock/50'}
            />
            <span className={on ? 'text-rock' : 'text-rock/70'}>
              {on ? 'One-click trading on' : 'One-click trading'}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 text-xs leading-relaxed">
          Approve once in your wallet and this browser gets its own trading key, so orders and
          cancels sign instantly. The key can only trade on your account; it can&apos;t move funds
          anywhere but back to your wallet. Turn it off anytime.
        </TooltipContent>
      </Tooltip>

      <button
        type="button"
        disabled={pending !== null}
        onClick={() => run(on ? 'disable' : 'enable')}
        className={cn(
          'flex shrink-0 items-center gap-1.5 font-medium transition-colors disabled:cursor-wait disabled:opacity-60',
          on
            ? 'text-rock/60 underline-offset-4 hover:text-rock hover:underline'
            : 'border border-rock/25 px-2 py-1 text-rock hover:border-lichen/50 hover:text-lichen'
        )}
      >
        {pending && <CircleNotch size={12} className="animate-spin" />}
        {pending === 'enable'
          ? 'Approve in wallet…'
          : pending === 'disable'
            ? 'Turning off…'
            : on
              ? 'Turn off'
              : 'Enable'}
      </button>
    </div>
  );
}
