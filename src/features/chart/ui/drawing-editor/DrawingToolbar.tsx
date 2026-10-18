/**
 * Floating bar for the selected drawing, at the bottom of its pane: color,
 * line width and style, the settings panel, lock and delete.
 *
 * The settings panel hosts the tabs in sections.ts; each tab edits the
 * drawing through the same `update`.
 */
import { memo, useState } from 'react';
import { Lock, LockOpen, PencilLine, Settings2, Trash2, type LucideIcon } from 'lucide-react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Popover, PopoverContent } from '@/shared/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/lib/utils';
import { DRAWING_TOOL_ICONS } from '@/features/chart/lib/drawing-tool-icons';
import { DRAWING_EDITOR_SECTIONS } from './sections';
import type { DrawingEditorProps } from './types';
import { ColorPicker } from './ColorPicker';

const WIDTHS = [1, 2, 3, 5, 8];
const LINE_STYLES = [
  { value: 'solid', label: 'Solid', dash: undefined },
  { value: 'dashed', label: 'Dashed', dash: '4 3' },
  { value: 'dotted', label: 'Dotted', dash: '1 3' },
] as const;

const BAR_BUTTON =
  'inline-flex h-7 min-w-7 items-center justify-center gap-1 px-1.5 text-rock/60 outline-none transition-colors hover:bg-rock/10 hover:text-rock data-[state=open]:bg-rock/10 data-[state=open]:text-rock';

function BarButton({
  label,
  icon: Icon,
  pressed,
  danger,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  pressed?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
          className={cn(BAR_BUTTON, pressed && 'text-primary', danger && 'hover:text-danger')}
        >
          <Icon className="size-3.5" strokeWidth={1.75} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function LineSample({ width, dash }: { width: number; dash?: string }) {
  return (
    <svg viewBox="0 0 24 8" className="h-2 w-6" aria-hidden>
      <line
        x1="1"
        y1="4"
        x2="23"
        y2="4"
        stroke="currentColor"
        strokeWidth={Math.min(width, 6)}
        strokeDasharray={dash}
        strokeLinecap={dash === '1 3' ? 'round' : 'butt'}
      />
    </svg>
  );
}

interface DrawingToolbarProps extends Omit<DrawingEditorProps, 'claimed'> {
  onRemove: () => void;
  /** Opens the inline text editor, for tools with editable text. */
  onEditText: () => void;
  /** Controlled, so double-clicking a drawing can open it. */
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
}

function DrawingToolbarComponent(props: DrawingToolbarProps) {
  const { drawing, tool, update, onRemove, onEditText, settingsOpen, onSettingsOpenChange } = props;
  const sections = DRAWING_EDITOR_SECTIONS.filter(s => s.applies(tool, drawing));
  const [tab, setTab] = useState<string | null>(null);
  const activeSection = sections.find(s => s.id === tab) ?? sections[0];
  // Sections claimed by tabs other than the active one.
  const claimed = new Set(sections.filter(s => s !== activeSection).flatMap(s => s.claims ?? []));
  const { style } = drawing;
  const lineStyle = LINE_STYLES.find(s => s.value === style.lineStyle) ?? LINE_STYLES[0];

  return (
    <div
      role="toolbar"
      aria-label={`${tool.label} drawing`}
      className="flex items-center gap-0.5 border border-outline bg-surface/95 p-0.5 shadow-lg backdrop-blur-sm"
      // Keep pointer input off the chart, which would deselect the drawing.
      onPointerDown={e => e.stopPropagation()}
    >
      <span className="flex items-center gap-1.5 border-r border-outline py-1 pl-1.5 pr-2 text-[11px] text-rock/70">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5"
          aria-hidden
          dangerouslySetInnerHTML={{
            __html: DRAWING_TOOL_ICONS[tool.type] ?? DRAWING_TOOL_ICONS.trendline,
          }}
        />
        <span className="max-w-32 truncate">{tool.label}</span>
      </span>

      <ColorPicker
        label="Drawing color"
        value={style.color}
        onChange={color => update({ style: { color } })}
      />

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className={BAR_BUTTON} aria-label="Line width" title="Line width">
          <LineSample width={style.width} />
          <span className="font-mono text-[10px]">{style.width}px</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="center" className="min-w-28">
          <DropdownMenuRadioGroup
            value={String(style.width)}
            onValueChange={v => update({ style: { width: Number(v) } })}
          >
            {WIDTHS.map(w => (
              <DropdownMenuRadioItem key={w} value={String(w)} className="text-xs">
                <LineSample width={w} />
                {w}px
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className={BAR_BUTTON} aria-label="Line style" title="Line style">
          <LineSample width={2} dash={lineStyle.dash} />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="center" className="min-w-28">
          <DropdownMenuRadioGroup
            value={style.lineStyle}
            onValueChange={v => update({ style: { lineStyle: v as typeof style.lineStyle } })}
          >
            {LINE_STYLES.map(s => (
              <DropdownMenuRadioItem key={s.value} value={s.value} className="text-xs">
                <LineSample width={2} dash={s.dash} />
                {s.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="mx-0.5 h-4 w-px bg-outline" aria-hidden />

      {tool.editableText && <BarButton label="Edit text" icon={PencilLine} onClick={onEditText} />}

      {sections.length > 0 && (
        <Popover open={settingsOpen} onOpenChange={onSettingsOpenChange}>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* The primitive forwards its ref, which the tooltip needs to anchor. */}
              <PopoverPrimitive.Trigger className={BAR_BUTTON} aria-label="Drawing settings">
                <Settings2 className="size-3.5" strokeWidth={1.75} />
              </PopoverPrimitive.Trigger>
            </TooltipTrigger>
            <TooltipContent side="top">Settings</TooltipContent>
          </Tooltip>
          <PopoverContent
            side="top"
            align="center"
            sideOffset={8}
            // Always above the toolbar: flipping per tab height moved the panel
            // under the pointer while switching tabs.
            avoidCollisions={false}
            className="flex max-h-[min(28rem,var(--radix-popover-content-available-height))] w-80 flex-col p-0"
            onPointerDown={e => e.stopPropagation()}
            // Escape in a text / number field discards its draft; elsewhere it closes.
            onEscapeKeyDown={e => {
              const target = e.target as HTMLElement | null;
              if (target?.matches('textarea, input[type=number], input[type=text]'))
                e.preventDefault();
            }}
          >
            <div className="flex items-center justify-between border-b border-outline px-3 py-2">
              <span className="text-xs font-medium text-rock">{tool.label}</span>
            </div>
            {sections.length > 1 && (
              <div role="tablist" className="flex border-b border-outline px-1">
                {sections.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={s === activeSection}
                    onClick={() => setTab(s.id)}
                    className={cn(
                      '-mb-px border-b px-2 py-1.5 text-[11px] text-rock/50 transition-colors hover:text-rock',
                      s === activeSection ? 'border-primary text-rock' : 'border-transparent'
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
            <div role="tabpanel" className="min-h-0 overflow-y-auto p-3">
              {activeSection && (
                <activeSection.Component
                  chart={props.chart}
                  drawing={drawing}
                  tool={tool}
                  update={update}
                  pricePrecision={props.pricePrecision}
                  claimed={claimed}
                />
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      <BarButton
        label={drawing.locked ? 'Unlock' : 'Lock'}
        icon={drawing.locked ? Lock : LockOpen}
        pressed={drawing.locked}
        onClick={() => update({ locked: !drawing.locked })}
      />
      <BarButton label="Delete" icon={Trash2} danger onClick={onRemove} />
    </div>
  );
}

export const DrawingToolbar = memo(DrawingToolbarComponent);
