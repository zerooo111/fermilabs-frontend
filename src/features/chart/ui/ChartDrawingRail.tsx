/**
 * Drawing tools down the left edge of the chart: the cursor, every CandleFrame
 * drawing tool in its six families (Lines, Fib & Gann, Patterns, Forecasting,
 * Shapes, Annotations), the magnet / keep drawing / hide toggles, then
 * undo / redo / clear.
 *
 * A family button picks the family's last-used tool; the arrow beside it opens
 * the full list, grouped by section.
 */
import { memo, useEffect, useState } from 'react';
import { builtInDrawingTools, type DrawingToolDefinition } from 'candleframe/core';
import {
  ChevronRight,
  Eye,
  EyeOff,
  Magnet,
  PencilLine,
  Undo2,
  Redo2,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/lib/utils';
import { DRAWING_TOOL_ICONS } from '@/features/chart/lib/drawing-tool-icons';
import { CandleFrameIcon } from './CandleFrameIcon';

export type MagnetMode = 'off' | 'weak' | 'strong';

const MAGNET_NEXT: Record<MagnetMode, MagnetMode> = { off: 'weak', weak: 'strong', strong: 'off' };
const MAGNET_LABEL: Record<MagnetMode, string> = {
  off: 'Magnet off',
  weak: 'Weak magnet',
  strong: 'Strong magnet',
};

const LAST_TOOLS_KEY = 'fermi:chart:drawing-last-tools';

interface ToolFamily {
  name: string;
  sections: { name: string; tools: DrawingToolDefinition[] }[];
  tools: DrawingToolDefinition[];
}

/** builtInDrawingTools grouped by family, then section, in catalog order. */
const FAMILIES: ToolFamily[] = (() => {
  const families = new Map<string, ToolFamily>();
  for (const tool of builtInDrawingTools) {
    let family = families.get(tool.group);
    if (!family) {
      family = { name: tool.group, sections: [], tools: [] };
      families.set(tool.group, family);
    }
    family.tools.push(tool);
    const sectionName = tool.section ?? tool.group;
    let section = family.sections.find(s => s.name === sectionName);
    if (!section) {
      section = { name: sectionName, tools: [] };
      family.sections.push(section);
    }
    section.tools.push(tool);
  }
  return [...families.values()];
})();

const TOOLS = new Map(builtInDrawingTools.map(tool => [tool.type, tool]));

function loadLastTools(): Record<string, string> {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_TOOLS_KEY) ?? '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

function ToolIcon({ tool, className }: { tool: string; className?: string }) {
  return (
    <CandleFrameIcon
      markup={DRAWING_TOOL_ICONS[tool] ?? DRAWING_TOOL_ICONS.trendline}
      className={className}
    />
  );
}

const RAIL_BUTTON =
  'flex size-7 items-center justify-center text-rock/55 transition-colors hover:bg-rock/10 hover:text-rock disabled:pointer-events-none disabled:opacity-30';

interface ChartDrawingRailProps {
  tool: string;
  onToolChange: (tool: string) => void;
  magnet: MagnetMode;
  onMagnetChange: (magnet: MagnetMode) => void;
  keepDrawing: boolean;
  onKeepDrawingChange: (keep: boolean) => void;
  drawingsHidden: boolean;
  onDrawingsHiddenChange: (hidden: boolean) => void;
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
  children,
}: {
  label: string;
  icon?: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
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
          className={cn(RAIL_BUTTON, active && 'bg-rock/10 text-primary')}
        >
          {Icon ? <Icon className="size-3.5" strokeWidth={1.75} /> : children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function FamilyButton({
  family,
  tool,
  lastTool,
  onToolChange,
}: {
  family: ToolFamily;
  tool: string;
  lastTool: DrawingToolDefinition;
  onToolChange: (tool: string) => void;
}) {
  const current = family.tools.find(t => t.type === tool);
  const shown = current ?? lastTool;
  return (
    <div className="group/family relative flex">
      <RailButton label={shown.label} active={!!current} onClick={() => onToolChange(shown.type)}>
        <ToolIcon tool={shown.type} />
      </RailButton>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          aria-label={`${family.name} tools`}
          title={`${family.name} tools`}
          className="absolute -right-1 top-0 flex h-7 w-2 items-center justify-center text-rock/25 opacity-0 outline-none transition-opacity hover:text-rock group-hover/family:opacity-100 focus-visible:opacity-100 data-[state=open]:text-rock data-[state=open]:opacity-100"
        >
          <ChevronRight className="size-2.5" strokeWidth={2.5} />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" sideOffset={6} className="min-w-56">
          {family.sections.map((section, i) => (
            <div key={section.name}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-rock/40">
                {section.name}
              </DropdownMenuLabel>
              {section.tools.map(t => (
                <DropdownMenuItem
                  key={t.type}
                  title={t.hint}
                  className={cn('text-xs', t.type === tool && 'text-primary')}
                  onSelect={() => onToolChange(t.type)}
                >
                  <ToolIcon tool={t.type} className="text-current" />
                  {t.label}
                </DropdownMenuItem>
              ))}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ChartDrawingRailComponent({
  tool,
  onToolChange,
  magnet,
  onMagnetChange,
  keepDrawing,
  onKeepDrawingChange,
  drawingsHidden,
  onDrawingsHiddenChange,
  canUndo,
  canRedo,
  hasDrawings,
  onUndo,
  onRedo,
  onClear,
}: ChartDrawingRailProps) {
  const [lastTools, setLastTools] = useState(loadLastTools);

  // Remember the tool picked in each family, so its button picks it again.
  useEffect(() => {
    const family = TOOLS.get(tool)?.group;
    if (!family || lastTools[family] === tool) return;
    const next = { ...lastTools, [family]: tool };
    setLastTools(next);
    try {
      localStorage.setItem(LAST_TOOLS_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: remembered for this session only.
    }
  }, [tool, lastTools]);

  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      aria-orientation="vertical"
      className="flex w-9 shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r border-outline py-1 [scrollbar-width:none]"
    >
      <RailButton label="Cursor" active={tool === 'cursor'} onClick={() => onToolChange('cursor')}>
        <ToolIcon tool="cursor" />
      </RailButton>
      {FAMILIES.map(family => (
        <FamilyButton
          key={family.name}
          family={family}
          tool={tool}
          lastTool={TOOLS.get(lastTools[family.name]) ?? family.tools[0]}
          onToolChange={onToolChange}
        />
      ))}
      <span className="my-1 h-px w-4 shrink-0 bg-outline" aria-hidden />
      <RailButton
        label={MAGNET_LABEL[magnet]}
        icon={Magnet}
        active={magnet !== 'off'}
        onClick={() => onMagnetChange(MAGNET_NEXT[magnet])}
      />
      <RailButton
        label="Keep drawing"
        icon={PencilLine}
        active={keepDrawing}
        onClick={() => onKeepDrawingChange(!keepDrawing)}
      />
      <RailButton
        label={drawingsHidden ? 'Show drawings' : 'Hide drawings'}
        icon={drawingsHidden ? EyeOff : Eye}
        active={drawingsHidden}
        onClick={() => onDrawingsHiddenChange(!drawingsHidden)}
      />
      <span className="my-1 h-px w-4 shrink-0 bg-outline" aria-hidden />
      <RailButton label="Undo" icon={Undo2} disabled={!canUndo} onClick={onUndo} />
      <RailButton label="Redo" icon={Redo2} disabled={!canRedo} onClick={onRedo} />
      <RailButton label="Clear drawings" icon={Trash2} disabled={!hasDrawings} onClick={onClear} />
    </div>
  );
}

export const ChartDrawingRail = memo(ChartDrawingRailComponent);
