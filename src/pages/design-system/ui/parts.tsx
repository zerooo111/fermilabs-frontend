/**
 * Small building blocks for the /design-system page. Built only from the
 * semantic tokens they document.
 */
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { cn } from '@/lib/utils';

import { grade } from '../lib/color';

export function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line-subtle pt-10 pb-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-tertiary">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-fg-primary">{title}</h2>
      {lede && <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-secondary">{lede}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 mt-8 text-sm font-medium text-fg-primary">{children}</h3>;
}

/** Click to copy a class name or value. */
export function CopyChip({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        'group inline-flex items-center gap-1.5 font-mono text-xs text-fg-secondary outline-none',
        'hover:text-fg-primary focus-visible:ring-2 focus-visible:ring-line-focus',
        className
      )}
      aria-label={`Copy ${value}`}
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check className="size-3 shrink-0 text-positive-fg" />
      ) : (
        <Copy className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      )}
    </button>
  );
}

export function GradeTag({ ratio }: { ratio: number | undefined }) {
  if (ratio === undefined || Number.isNaN(ratio)) {
    return <span className="font-mono text-[11px] text-fg-tertiary">…</span>;
  }
  const g = grade(ratio);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-[11px] tabular-nums',
        g === 'Fail'
          ? 'text-negative-fg'
          : g === 'AA large'
            ? 'text-warning-fg'
            : 'text-fg-secondary'
      )}
    >
      {ratio.toFixed(2)}
      <span className="text-fg-tertiary">{g}</span>
    </span>
  );
}

/** A horizontally scrollable wrapper so wide tables never push the page. */
export function TableScroll({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto border border-line">{children}</div>;
}

export const TH =
  'h-9 border-b border-line bg-surface-raised px-3 text-left font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-fg-tertiary whitespace-nowrap';
export const TD = 'border-b border-line-subtle px-3 py-2.5 align-middle text-sm text-fg-secondary';
