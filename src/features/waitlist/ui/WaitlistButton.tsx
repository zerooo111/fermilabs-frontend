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

import { waitlistOpenAtom, waitlistSourceAtom } from '../model/waitlistAtoms';

interface WaitlistButtonProps {
  source?: string;
  /** Replaces the default 'Join Waitlist' label. */
  label?: string;
  /** If true, render the right arrow icon (matches landing CTAs). */
  withArrow?: boolean;
  /** Override styling. Defaults to the amber-200 CTA style. */
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
          'underline underline-offset-2 decoration-rock/40 hover:decoration-amber-200 hover:text-amber-100 duration-150 ease-out'
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
        'hover:brightness-120 bg-amber-200 group text-dark-forest px-6 sm:px-8 py-3 sm:py-4 text-lg sm:text-xl md:text-2xl font-medium flex items-center justify-center gap-3 sm:gap-4 relative overflow-hidden duration-150 ease-out cursor-pointer'
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
