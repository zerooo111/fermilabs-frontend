/**
 * Drop-in replacement for the landing page's "Coming Soon" stubs. Opens the
 * global WaitlistDialog with an optional `source` tag so we can attribute
 * signups by surface (hero / cta / header / footer / invite-modal).
 *
 * Styled to match the existing landing page CTA buttons. Override via
 * `className` for a different variant (e.g. inline link in the header).
 */
import { useSetAtom } from 'jotai';
import { ArrowRight } from '@phosphor-icons/react';
import posthog from 'posthog-js';

import { waitlistOpenAtom, waitlistSourceAtom } from '../model/waitlistAtoms';

interface WaitlistButtonProps {
  source?: string;
  /** Replaces the default 'Join Waitlist' label. */
  label?: string;
  /** If true, render the right arrow icon (matches landing CTAs). */
  withArrow?: boolean;
  /** Override styling. Defaults to the accent-solid CTA style. */
  className?: string;
  /** Hide the icon entirely (e.g. for nav links). */
  variant?: 'cta' | 'inline';
  onClick?: () => void;
}

export function WaitlistButton({
  source,
  label = 'Join Waitlist',
  withArrow = true,
  className,
  variant = 'cta',
  onClick,
}: WaitlistButtonProps) {
  const setOpen = useSetAtom(waitlistOpenAtom);
  const setSource = useSetAtom(waitlistSourceAtom);

  const handleClick = () => {
    posthog.capture('waitlist_opened', { source: source ?? null });
    setSource(source ?? null);
    setOpen(true);
    onClick?.();
  };

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={
          className ??
          'underline underline-offset-2 decoration-line-on-brand-strong hover:decoration-accent-solid hover:text-accent-fg duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-line-focus'
        }
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={
        className ??
        'bg-accent-solid hover:bg-accent-solid-hover group text-fg-on-accent px-6 sm:px-8 py-3 sm:py-4 text-lg sm:text-xl md:text-2xl font-medium flex items-center justify-center gap-3 sm:gap-4 relative overflow-hidden duration-150 ease-out cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-line-focus'
      }
    >
      {label}
      {withArrow && (
        <ArrowRight
          weight="bold"
          size={20}
          className="group-hover:scale-110 origin-center group-hover:-rotate-45 transition-all duration-200 relative sm:w-6 sm:h-6"
        />
      )}
    </button>
  );
}
