/**
 * Renders one of CandleFrame's 24-unit stroke icons (drawing tools, chart
 * types) from the markup copied into drawing-tool-icons.ts / chart-type-icons.ts.
 */
import { cn } from '@/lib/utils';

export function CandleFrameIcon({ markup, className }: { markup: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn('size-4', className)}
      // Static markup from our own icon maps, never user input.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
