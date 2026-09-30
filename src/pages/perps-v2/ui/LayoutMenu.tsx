// Everything about how the terminal looks, in one navbar popover: layout
// preset, which panes are open, colour theme, and reset.

import { Check, Layout, Leaf, Moon, Sun } from '@phosphor-icons/react';

import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

import { PRESETS, type PresetId } from '../lib/layouts';
import { PANES, type PaneDef } from '../lib/panels';
import { THEMES, type ThemeId } from '../lib/theme';

const THEME_ICONS: Record<ThemeId, typeof Sun> = { day: Sun, night: Moon, fermi: Leaf };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 px-3 py-3 border-b border-[var(--glass-divider)] last:border-b-0">
      <h3 className="text-[11px] font-medium text-fg-tertiary">{title}</h3>
      {children}
    </section>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string; icon?: typeof Sun }[];
  value: T | null;
  onChange: (id: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-flow-col auto-cols-fr">
      {options.map(o => {
        const checked = value === o.id;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(o.id)}
            className={cn(
              'flex h-8 items-center justify-center gap-1.5 border border-[var(--glass-control)] -ml-px first:ml-0 text-xs transition-colors',
              checked
                ? 'relative z-10 border-fg-primary bg-surface-inverse text-fg-inverse'
                : 'text-fg-secondary hover:bg-state-hover hover:text-fg-primary'
            )}
          >
            {Icon && <Icon size={13} weight={checked ? 'fill' : 'regular'} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function LayoutMenu({
  preset,
  onPreset,
  open,
  onTogglePane,
  theme,
  onTheme,
  onReset,
}: {
  preset: PresetId | null;
  onPreset: (id: PresetId) => void;
  open: Set<string>;
  onTogglePane: (pane: PaneDef) => void;
  theme: ThemeId;
  onTheme: (id: ThemeId) => void;
  onReset: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        className="flex h-9 items-center gap-2 px-3 border border-line text-sm text-fg-secondary hover:text-fg-primary hover:bg-state-hover data-[state=open]:bg-state-selected data-[state=open]:text-fg-primary transition-colors"
        aria-label="Layout and theme"
      >
        <Layout size={16} />
        <span className="hidden sm:inline">Layout</span>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 p-0">
        <Section title="Layout">
          <Segmented label="Layout preset" options={PRESETS} value={preset} onChange={onPreset} />
        </Section>

        <Section title="Panes">
          <div className="grid grid-cols-2 gap-x-2">
            {PANES.map(p => {
              const isOpen = open.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={isOpen}
                  onClick={() => onTogglePane(p)}
                  className="flex h-8 items-center gap-2 px-1.5 -mx-1.5 text-left text-xs text-fg-secondary hover:bg-state-hover hover:text-fg-primary transition-colors"
                >
                  <span
                    className={cn(
                      'grid size-3.5 shrink-0 place-items-center border',
                      isOpen
                        ? 'border-fg-primary bg-fg-primary text-fg-inverse'
                        : 'border-[var(--glass-control)]'
                    )}
                  >
                    {isOpen && <Check size={10} weight="bold" />}
                  </span>
                  <span className={cn('truncate', isOpen && 'text-fg-primary')}>{p.title}</span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Theme">
          <Segmented
            label="Theme"
            options={THEMES.map(t => ({ ...t, icon: THEME_ICONS[t.id] }))}
            value={theme}
            onChange={onTheme}
          />
        </Section>

        <div className="px-3 py-2.5">
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-fg-tertiary underline decoration-line-strong underline-offset-4 hover:text-fg-primary"
          >
            Reset layout
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
