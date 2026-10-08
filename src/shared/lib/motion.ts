/**
 * Motion presets for the terminal. Import springs from here rather than
 * tuning numbers inline so every slide, pop and morph in the app shares the
 * same physical feel.
 *
 * Usage:
 *   <motion.span layoutId="tab-underline" transition={springs.snappy} />
 *   <motion.div animate={{ scale: 1 }} transition={springs.gooey} />
 */
import type { Transition } from 'motion/react';

export const springs = {
  /** Indicators that track a click: tab underlines, toggle pills. Settles fast, no visible overshoot. */
  snappy: { type: 'spring', stiffness: 700, damping: 45, mass: 0.6 } satisfies Transition,
  /** Panels and sheets moving into place. Fluid, with a hint of follow-through. */
  fluid: { type: 'spring', stiffness: 380, damping: 32, mass: 0.9 } satisfies Transition,
  /** Playful pops: badges, pills, hover scale. Noticeable overshoot. */
  gooey: { type: 'spring', stiffness: 520, damping: 18, mass: 0.7 } satisfies Transition,
  /** Price flashes, counters. Short and crisp, no bounce. */
  tick: { type: 'spring', stiffness: 900, damping: 60, mass: 0.4 } satisfies Transition,
} as const;

/** Standard enter/exit for small floating things (toasts, chips). */
export const popIn = {
  initial: { opacity: 0, scale: 0.92, y: 4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 2 },
} as const;
