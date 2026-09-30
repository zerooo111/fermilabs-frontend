/**
 * Rules, the case against white-with-alpha, and the primitive ramps.
 */
import { BRAND_RAMP, FOREST_RAMP } from '../model/tokens';
import { contrast, toHex, tokenVar, useTokens } from '../lib/color';
import { CopyChip, GradeTag, Section, SubHeading } from './parts';

const RULES = [
  {
    title: 'Components use semantic tokens',
    body: 'Write bg-surface-raised, not bg-forest-850 and not bg-white/5. Primitives exist to define tokens. If no token fits, add one here first.',
  },
  {
    title: 'Flat first, then opaque',
    body: 'Panels are unfilled and sit on the canvas, framed by lines. When something must lift, it steps up one opaque surface: raised for header strips, overlay for menus.',
  },
  {
    title: 'Alpha is for states',
    body: 'Hover, pressed and selected are the only translucent tokens. They tint whatever surface they land on.',
  },
  {
    title: 'Readable text stops at tertiary',
    body: 'fg-tertiary clears 4.5:1 on every surface up to overlay. Anything dimmer is disabled, and looks it.',
  },
  {
    title: 'Green and red carry meaning',
    body: 'Positive and negative mean direction or outcome. Never use them to decorate. Brand green stays on the landing page.',
  },
];

export function Rules() {
  return (
    <Section
      id="rules"
      eyebrow="01 Rules"
      title="Five rules"
      lede="Read these before reaching for a color. Every token on this page follows from them."
    >
      <ol className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {RULES.map((rule, i) => (
          <li
            key={rule.title}
            className="flex flex-col gap-2 bg-surface-base p-5 last:sm:col-span-2 lg:last:col-span-2"
          >
            <span className="font-mono text-xs text-fg-tertiary">0{i + 1}</span>
            <span className="text-sm font-medium text-fg-primary">{rule.title}</span>
            <span className="text-sm leading-6 text-fg-secondary">{rule.body}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** The same card on two backdrops, built both ways. */
function DriftDemo({ mode }: { mode: 'alpha' | 'opaque' }) {
  const card = mode === 'alpha' ? 'bg-white/5 border-white/20' : 'bg-surface-raised border-line';
  const inner = mode === 'alpha' ? 'bg-white/5' : 'bg-surface-overlay';
  const label = mode === 'alpha' ? 'text-white/50' : 'text-fg-tertiary';

  return (
    <div className="grid grid-cols-2">
      {(['bg-surface-canvas', 'bg-surface-brand'] as const).map(backdrop => (
        <div key={backdrop} className={`${backdrop} p-4`}>
          <div className={`border ${card} p-3`}>
            <p className={`font-mono text-[11px] uppercase tracking-[0.12em] ${label}`}>Equity</p>
            <p className="mt-1 font-mono text-lg text-fg-primary">$12,480.22</p>
            <div className={`${inner} mt-3 px-2 py-1.5 text-xs ${label}`}>Nested row</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function WhyOpaque() {
  return (
    <Section
      id="why"
      eyebrow="02 Why"
      title="Why we are moving off white with alpha"
      lede={
        <>
          Most of the app is painted with{' '}
          <code className="font-mono text-fg-primary">bg-white/5</code>,{' '}
          <code className="font-mono text-fg-primary">text-white/50</code> and friends: 281 uses of
          white or rock with alpha, at 20 different opacities. Alpha takes its color from whatever
          sits behind it. The same card changes hue on the brand green, nested fills stack into
          steps nobody chose, and a label that passes contrast on the canvas fails inside a popover.
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <figure className="border border-line">
          <DriftDemo mode="alpha" />
          <figcaption className="border-t border-line bg-surface-base px-4 py-3 text-sm text-fg-secondary">
            <span className="text-negative-fg">Today.</span> bg-white/5 turns green on the brand
            backdrop, and the nested row is a third color.
          </figcaption>
        </figure>
        <figure className="border border-line">
          <DriftDemo mode="opaque" />
          <figcaption className="border-t border-line bg-surface-base px-4 py-3 text-sm text-fg-secondary">
            <span className="text-positive-fg">Tokens.</span> surface-raised and surface-overlay are
            the same pixels on both backdrops.
          </figcaption>
        </figure>
      </div>
    </Section>
  );
}

export function Primitives() {
  const forestNames = FOREST_RAMP.map(s => `forest-${s.step}`);
  const brandNames = BRAND_RAMP.map(s => `brand-${s}`);
  const values = useTokens([...forestNames, ...brandNames, 'forest-950', 'forest-50']);
  const canvas = values['forest-950'];
  const rock = values['forest-50'];

  return (
    <Section
      id="primitives"
      eyebrow="03 Primitives"
      title="Forest and brand ramps"
      lede={
        <>
          The forest ramp runs from the canvas green to rock (#f8f7e7), our cream, and is set in
          OKLCH. Lightness climbs in even steps through the dark half, where the surfaces live.
          Chroma holds steady there so the neutrals stay green instead of going gray, and the hue
          only turns toward rock's warm yellow in the light half. Do not use these names in
          components.
        </>
      }
    >
      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-15 border border-line">
          {FOREST_RAMP.map(s => {
            const name = `forest-${s.step}`;
            const v = values[name];
            const light = Number(s.step) <= 400;
            return (
              <div key={name} className="flex flex-col">
                <div
                  className="flex h-24 items-end p-2 font-mono text-[11px]"
                  style={{
                    background: tokenVar(name),
                    color: light ? tokenVar('forest-950') : tokenVar('forest-50'),
                  }}
                >
                  {s.step}
                </div>
                <div className="flex flex-col gap-0.5 border-t border-line bg-surface-base p-2 font-mono text-[10px] text-fg-tertiary">
                  <span className="text-fg-secondary">{v ? toHex(v) : '…'}</span>
                  <span>{s.l}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <SubHeading>Brand</SubHeading>
      <div className="grid gap-px border border-line bg-line sm:grid-cols-3">
        {brandNames.map(name => {
          const v = values[name];
          return (
            <div key={name} className="flex flex-col bg-surface-base">
              <div
                className="flex h-24 items-end justify-between p-3"
                style={{ background: tokenVar(name) }}
              >
                <span className="font-display text-2xl text-fg-primary">Fermi</span>
                <GradeTag ratio={v && rock ? contrast(rock, v) : undefined} />
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-line p-3">
                <CopyChip value={name} />
                <span className="font-mono text-[11px] text-fg-tertiary">{v ? toHex(v) : ''}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-fg-tertiary">
        Ratio shown is rock text on the swatch. brand-500 is the existing dark-forest. Canvas is{' '}
        {canvas ? toHex(canvas) : '…'}.
      </p>
    </Section>
  );
}
