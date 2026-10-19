/**
 * Chart settings, like TradingView's: Symbol (candle and line colors), Status
 * line (the legend), Scales and Canvas. Changes apply live to every pane; the
 * dialog is non-modal so the chart stays visible behind it.
 */
import { memo, useState, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { cn } from '@/lib/utils';
import { SECTION_HEADING } from '@/features/chart/lib/drawing-settings';
import {
  DEFAULT_CHART_SETTINGS,
  TIME_ZONES,
  type ChartSettings,
  type LineDash,
} from '@/features/chart/lib/chart-settings';
import { ColorPicker } from './drawing-editor/ColorPicker';
import { DrawingNumberInput, SETTING_ROW } from './drawing-editor/DrawingSettingFields';

type Tab = 'symbol' | 'legend' | 'scales' | 'canvas';

const TABS: { id: Tab; label: string }[] = [
  { id: 'symbol', label: 'Symbol' },
  { id: 'legend', label: 'Status line' },
  { id: 'scales', label: 'Scales' },
  { id: 'canvas', label: 'Canvas' },
];

const DASH_CHOICES: { value: LineDash; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

/** Partial update of one settings group. */
type Patch = <G extends keyof ChartSettings>(group: G, value: Partial<ChartSettings[G]>) => void;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-0.5">
      <legend className={cn(SECTION_HEADING, 'mb-1')}>{title}</legend>
      {children}
    </fieldset>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={SETTING_ROW}>
      <span>{label}</span>
      <span className="flex items-center gap-1">{children}</span>
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={cn(SETTING_ROW, 'cursor-pointer justify-start hover:text-rock')}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="size-3.5 accent-[var(--color-primary)]"
      />
      {label}
    </label>
  );
}

function Percent({
  label,
  value,
  min = 0,
  max = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <Row label={label}>
      <DrawingNumberInput
        label={label}
        value={Math.round(value * 100)}
        min={min * 100}
        max={max * 100}
        step={1}
        onCommit={next => onChange(next / 100)}
      />
      <span className="text-rock/40">%</span>
    </Row>
  );
}

function Choice<T extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: T;
  choices: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <Row label={label}>
      <Select value={value} onValueChange={v => onChange(v as T)}>
        <SelectTrigger size="sm" aria-label={label} className="h-7 min-w-32 px-2 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {choices.map(choice => (
            <SelectItem key={choice.value} value={choice.value} className="text-xs">
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Row>
  );
}

function SymbolTab({ settings, patch }: { settings: ChartSettings; patch: Patch }) {
  const { candles, line } = settings;
  return (
    <>
      <Section title="Candles">
        <Row label="Body">
          <ColorPicker
            label="Up body"
            value={candles.up}
            onChange={up => patch('candles', { up })}
          />
          <ColorPicker
            label="Down body"
            value={candles.down}
            onChange={down => patch('candles', { down })}
          />
        </Row>
        <Row label="Wick">
          <ColorPicker
            label="Up wick"
            value={candles.wickUp}
            onChange={wickUp => patch('candles', { wickUp })}
          />
          <ColorPicker
            label="Down wick"
            value={candles.wickDown}
            onChange={wickDown => patch('candles', { wickDown })}
          />
        </Row>
        <Percent
          label="Body width"
          value={candles.bodyRatio}
          min={0.1}
          onChange={bodyRatio => patch('candles', { bodyRatio })}
        />
        <Row label="Wick width">
          <DrawingNumberInput
            label="Wick width"
            value={candles.wickWidth}
            min={0.5}
            max={4}
            step={0.5}
            onCommit={wickWidth => patch('candles', { wickWidth })}
          />
          <span className="text-rock/40">px</span>
        </Row>
      </Section>
      <Section title="Line, area and baseline">
        <Row label="Line">
          <ColorPicker
            label="Line color"
            value={line.color}
            onChange={color => patch('line', { color })}
          />
          <DrawingNumberInput
            label="Line width"
            value={line.width}
            min={0.5}
            max={6}
            step={0.5}
            onCommit={width => patch('line', { width })}
          />
          <span className="text-rock/40">px</span>
        </Row>
        <Percent
          label="Area fill"
          value={line.areaOpacity}
          onChange={areaOpacity => patch('line', { areaOpacity })}
        />
        <Row label="Baseline">
          <ColorPicker
            label="Baseline above"
            value={line.baselineUp}
            onChange={baselineUp => patch('line', { baselineUp })}
          />
          <ColorPicker
            label="Baseline below"
            value={line.baselineDown}
            onChange={baselineDown => patch('line', { baselineDown })}
          />
        </Row>
      </Section>
    </>
  );
}

function LegendTab({ settings, patch }: { settings: ChartSettings; patch: Patch }) {
  const { legend } = settings;
  return (
    <Section title="Legend">
      <Check
        label="OHLC values"
        checked={legend.ohlcValues}
        onChange={ohlcValues => patch('legend', { ohlcValues })}
      />
      <Check
        label="Bar change"
        checked={legend.change}
        onChange={change => patch('legend', { change })}
      />
      <Check
        label="Indicator titles"
        checked={legend.indicators}
        onChange={indicators => patch('legend', { indicators })}
      />
    </Section>
  );
}

function ScalesTab({ settings, patch }: { settings: ChartSettings; patch: Patch }) {
  const { scales } = settings;
  return (
    <>
      <Section title="Time">
        <Choice
          label="Time zone"
          value={scales.timeZone}
          choices={TIME_ZONES}
          onChange={timeZone => patch('scales', { timeZone })}
        />
      </Section>
      <Section title="Price">
        <Check
          label="Last price line"
          checked={scales.lastPriceLine}
          onChange={lastPriceLine => patch('scales', { lastPriceLine })}
        />
        <Row label="Axis text">
          <DrawingNumberInput
            label="Axis text size"
            value={scales.axisTextSize}
            min={8}
            max={20}
            step={1}
            onCommit={axisTextSize => patch('scales', { axisTextSize })}
          />
          <span className="text-rock/40">px</span>
        </Row>
      </Section>
    </>
  );
}

function CanvasTab({ settings, patch }: { settings: ChartSettings; patch: Patch }) {
  const { canvas } = settings;
  return (
    <>
      <Section title="Background">
        <Row label="Color">
          <ColorPicker
            label="Background color"
            value={canvas.background}
            onChange={background => patch('canvas', { background })}
          />
        </Row>
      </Section>
      <Section title="Grid">
        <Check
          label="Grid lines"
          checked={canvas.grid}
          onChange={grid => patch('canvas', { grid })}
        />
        <Row label="Color">
          <ColorPicker
            label="Grid color"
            value={canvas.gridColor}
            disabled={!canvas.grid}
            onChange={gridColor => patch('canvas', { gridColor })}
          />
        </Row>
      </Section>
      <Section title="Crosshair">
        <Row label="Color">
          <ColorPicker
            label="Crosshair color"
            value={canvas.crosshairColor}
            onChange={crosshairColor => patch('canvas', { crosshairColor })}
          />
        </Row>
        <Choice
          label="Style"
          value={canvas.crosshairStyle}
          choices={DASH_CHOICES}
          onChange={crosshairStyle => patch('canvas', { crosshairStyle })}
        />
      </Section>
    </>
  );
}

interface ChartSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ChartSettings;
  onChange: (settings: ChartSettings) => void;
}

function ChartSettingsDialogComponent({
  open,
  onOpenChange,
  settings,
  onChange,
}: ChartSettingsDialogProps) {
  const [tab, setTab] = useState<Tab>('symbol');
  const patch: Patch = (group, value) =>
    onChange({ ...settings, [group]: { ...settings[group], ...value } });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        className="flex h-[min(30rem,calc(100vh-4rem))] max-w-xl flex-col gap-0 bg-surface p-0 shadow-2xl"
        // Color and select popups render outside the dialog; don't close on them.
        onInteractOutside={e => {
          const target = e.target as HTMLElement | null;
          if (target?.closest('[data-radix-popper-content-wrapper]')) e.preventDefault();
        }}
      >
        <div className="border-b border-outline px-4 py-3">
          <DialogTitle className="text-sm font-medium">Chart settings</DialogTitle>
          <DialogDescription className="sr-only">
            Colors, legend, scales and canvas for every chart.
          </DialogDescription>
        </div>
        <div className="flex min-h-0 flex-1">
          <div
            role="tablist"
            aria-orientation="vertical"
            className="flex w-32 shrink-0 flex-col border-r border-outline py-2"
          >
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  'px-4 py-1.5 text-left text-xs text-rock/55 transition-colors hover:text-rock',
                  tab === id && 'bg-rock/10 text-rock'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {tab === 'symbol' && <SymbolTab settings={settings} patch={patch} />}
            {tab === 'legend' && <LegendTab settings={settings} patch={patch} />}
            {tab === 'scales' && <ScalesTab settings={settings} patch={patch} />}
            {tab === 'canvas' && <CanvasTab settings={settings} patch={patch} />}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-outline px-4 py-2.5">
          <button
            type="button"
            onClick={() => onChange(DEFAULT_CHART_SETTINGS)}
            className="inline-flex items-center gap-1.5 text-xs text-rock/55 transition-colors hover:text-rock"
          >
            <RotateCcw className="size-3" />
            Reset to defaults
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-7 bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const ChartSettingsDialog = memo(ChartSettingsDialogComponent);
