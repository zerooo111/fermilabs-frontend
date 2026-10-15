/**
 * Drawing tools down the left edge of the chart: the cursor, a short list of
 * CandleFrame drawing tools, then undo / redo / clear.
 */
import { memo } from 'react';
import {
  MousePointer2,
  Slash,
  Minus,
  Rows3,
  Square,
  Type,
  Ruler,
  Undo2,
  Redo2,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/lib/utils';

/** CandleFrame drawing tool ids (see builtInDrawingTools). */
const DRAWING_TOOLS: { tool: string; label: string; icon: LucideIcon }[] = [
  { tool: 'cursor', label: 'Cursor', icon: MousePointer2 },
  { tool: 'trendline', label: 'Trend line', icon: Slash },
  { tool: 'horizontal-line', label: 'Horizontal line', icon: Minus },
  { tool: 'fib-retracement', label: 'Fib retracement', icon: Rows3 },
  { tool: 'rectangle', label: 'Rectangle', icon: Square },
  { tool: 'text', label: 'Text', icon: Type },
  { tool: 'date-price-range', label: 'Measure', icon: Ruler },
];

interface ChartDrawingRailProps {
  tool: string;
  onToolChange: (tool: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  hasDrawings: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

function RailButton({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            'flex size-7 items-center justify-center text-rock/55 transition-colors hover:bg-rock/10 hover:text-rock disabled:pointer-events-none disabled:opacity-30',
            active && 'bg-rock/10 text-primary'
          )}
        >
          <Icon className="size-3.5" strokeWidth={1.75} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function ChartDrawingRailComponent({
  tool,
  onToolChange,
  canUndo,
  canRedo,
  hasDrawings,
  onUndo,
  onRedo,
  onClear,
}: ChartDrawingRailProps) {
  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      aria-orientation="vertical"
      className="flex w-8 shrink-0 flex-col items-center gap-0.5 border-r border-outline py-1"
    >
      {DRAWING_TOOLS.map(({ tool: id, label, icon }) => (
        <RailButton
          key={id}
          label={label}
          icon={icon}
          active={tool === id}
          onClick={() => onToolChange(id)}
        />
      ))}
      <span className="my-1 h-px w-4 bg-outline" aria-hidden />
      <RailButton label="Undo" icon={Undo2} disabled={!canUndo} onClick={onUndo} />
      <RailButton label="Redo" icon={Redo2} disabled={!canRedo} onClick={onRedo} />
      <RailButton label="Clear drawings" icon={Trash2} disabled={!hasDrawings} onClick={onClear} />
    </div>
  );
}

export const ChartDrawingRail = memo(ChartDrawingRailComponent);
