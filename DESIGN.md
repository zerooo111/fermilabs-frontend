# Design: Forest & Dither

The visual language of the fermi.trade landing page, shared with
[fermilabs.xyz](https://fermilabs.xyz). Read this before touching
`src/pages/home/` or building anything that should look like it.

In one line: **a technical drawing sheet printed on deep forest green, with
ordered-dither texture and blueprint line drawings that quietly move.**

It should feel engineered, not decorated. Every mark on the page is either
structure (rules, frames, registration marks), information (a drawing that
explains how Fermi works) or texture (dither). Nothing is ornamental for its
own sake: no gradients-for-mood, no glows, no glassy blobs, no stock imagery.

---

## 1. Forest theme

### Palette

The whole page is built from five colours. Everything else is one of these at
an opacity, or a dither tone derived from them.

| Token         | Hex         | Role                                                                    |
| ------------- | ----------- | ----------------------------------------------------------------------- |
| `dark-forest` | `#185038`   | The ground. Page, cards, header, demo window.                           |
| `rock`        | `#f8f7e7`   | Ink. Text, rules, line drawings. Never pure white.                      |
| `lichen`      | `#b4dc78`   | Primary accent. Active, ordered, "bid" side of drawings.                |
| `amber-200`   | ≈ `#fee685` | Signal accent. CTAs, registration marks, focus, highlights, "ask" side. |
| `amber-100`   | ≈ `#fef3c6` | Hover state for amber and for linked text.                              |

Defined in `src/index.css` (`--color-dark-forest`, `--color-rock`,
`--color-lichen`; amber is Tailwind's, defined in OKLCH, so the hex values
above are approximate. Use the tokens, not the hex).

**Rock at opacity is the whole greyscale.** Use these steps and no others:

| Opacity             | Use                                         |
| ------------------- | ------------------------------------------- |
| `rock/15`           | Rules, frame sides, card borders, grid gaps |
| `rock/25`           | Caption and chip borders                    |
| `rock/55`–`rock/60` | Meta text: dates, counts, footer            |
| `rock/65`–`rock/75` | Body and secondary text, nav                |
| `rock/85`           | Secondary links                             |
| `rock`              | Headlines, primary text                     |

**Derived solids** (use when a surface must be opaque so nothing shows
through it):

| Value           | Use                                                       |
| --------------- | --------------------------------------------------------- |
| `rgb(21 70 49)` | Blueprint paper: `dark-forest` + 12% black                |
| `#35654e`       | Opaque `rock/15` on forest, for the demo's inner borders  |
| `#436f59`       | Opaque `rock/25` on forest, for the demo window and toast |

### Trading colours are the exception

Red and green appear **only** inside the terminal demo, and they are the exact
values from `/perps` so the demo reads as the real product:

| Token     | Hex       | Use                                      |
| --------- | --------- | ---------------------------------------- |
| `success` | `#10b981` | Buy / Long, bids, gains, up candles      |
| `danger`  | `#ef4444` | Sell / Short, asks, losses, down candles |

Depth bars use `emerald-500` / `red-500` at 25%. The fill toast keeps
`green-400`, matching `OrderToast`. Everywhere else on the landing, the two
sides of a market are **lichen (bids) and amber (asks)**, never red and green.

### Typography

| Family                               | Token                                | Use                                                                |
| ------------------------------------ | ------------------------------------ | ------------------------------------------------------------------ |
| Newsreader (300–600, optical sizing) | `font-serif`                         | Headlines, section titles, card titles, the "Fermi Trade" wordmark |
| Hanken Grotesk (400–600)             | `--font-grotesk` (set on `.landing`) | Body, UI, nav, captions, drawing labels                            |
| Geist Mono                           | `font-mono`                          | Numbers in the terminal demo only                                  |

Scale and treatment:

- **Hero:** `font-serif font-light`, `clamp(2.75rem, 7vw, 6.25rem)`,
  `leading-[1.1]`, `tracking-[-0.03em]`.
- **Section title:** `font-serif font-light text-4xl md:text-5xl leading-none
tracking-[-0.02em]`.
- **Card title:** `font-serif text-2xl md:text-3xl tracking-[-0.01em]`.
- **Eyebrow / field labels:** Grotesk, `text-xs uppercase tracking-[0.2em]`,
  `rock/60`.
- Serif is always light or regular, never bold. Weight comes from size.
- Sentence case everywhere, including buttons ("Join the waitlist"). Labels
  inside drawings are lowercase ("price-time priority").

---

## 2. The drawing sheet

The page is laid out like an engineering drawing.

- **`.frame`**: every section's content sits in a centred 1280px column with
  1px `rock/15` rules down both sides. Sections are full-bleed rows; the frame
  lives inside them.
- **Rules between sections**: `border-b border-rock/15` on the full-width
  section, so horizontal rules run edge to edge and cross the frame.
- **`.reg`**: registration marks. An 11px amber cross (70% opacity) where a
  horizontal rule meets the frame. Add `.reg` to the frame element that starts
  a new band.
- **Grids** are drawn with `gap-px bg-rock/15` on the grid and
  `bg-dark-forest` on each cell, so the gaps become 1px rules.
- **Gutters**: `px-5 md:px-10`. Section header bands: `py-8 md:py-10`.
  Cards: `py-8 md:py-10`, `gap-6` inside.
- **Section header band**: title on the left, optional link or note on the
  right, bottom-aligned (`sm:items-end sm:justify-between`).
- Square corners everywhere. No `rounded-*` on the landing, apart from the
  terminal demo, which copies the app.

---

## 3. Dither

Dither is the texture of the brand. It is always an **8×8 Bayer ordered
dither**, always quantised to a handful of forest-derived tones, and always
rendered with hard pixels (`image-rendering: pixelated`, CSS class
`.pixelated`).

### Rules

- **Cell size is 3 CSS px.** Canvases render at `width / 3` and are scaled up.
- **Tones come from the forest.** Darkest first, and level 0 is transparent
  so the page shows through. Never dither to black or to pure white.
- **Few levels.** 3–5 tones per ramp. The texture is the point, not smooth
  shading.
- **Dither fades out; it never stops at a hard edge.** Bands fade vertically,
  fields fade at both horizontal ends (`.edge-fade` mask), the hover glow
  fades in.

### Static dither (pre-rendered PNGs, `public/dither/`)

| Class               | Asset           | Use                                                                             |
| ------------------- | --------------- | ------------------------------------------------------------------------------- |
| `.dither-band`      | `fade-up.png`   | 72px band that rises into the next section (above the CTA)                      |
| `.dither-band-down` | `fade-down.png` | 72px band that falls from a rule                                                |
| `.dither-footer`    | `footer.png`    | 144px band at the top of the footer                                             |
| `.dither-corner`    | `corner.png`    | Corner patch on cards on hover or focus (touch, reduced motion, no-JS fallback) |

Tiles are 8px wide, displayed at 24px (3×), `repeat-x`.

### Live dither (canvas, `src/pages/home/lib/`)

| Module               | What it draws                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dither.ts`          | Shared kit: `BAYER`, `ditherLevel(v, levels, x, y)`, `packColor` (one `Uint32` write per pixel), `createClock()` (fixed 60 steps/s), `prefersReducedMotion()` |
| `logo-field.ts`      | Hero: the 7×4 pixel mark as tiles of dithered cells. Cells scatter on load and spring home; the pointer pushes them away                                      |
| `orderbook-field.ts` | The "how it works" band: a live FIFO order book over a dithered cumulative depth chart                                                                        |
| `dither-hover.ts`    | Card hover: slow Lissajous blobs of dithered glow, only a shade above the card colour                                                                         |

To add a new dithered canvas, follow the same contract:

1. Render to `ImageData` through a `Uint32Array` view, using `packColor` tones.
2. Advance the simulation with `createClock().steps(now)`, so it runs at the
   same speed on 60 Hz and 120 Hz displays.
3. Read layout in pointer handlers, never inside `requestAnimationFrame`.
4. Stop the loop when offscreen (`IntersectionObserver`) and when settled.
5. With reduced motion, render one still frame and return.
6. Lazy-load the module (`whenNear` or `requestIdleCallback`) and return a
   cleanup function for the React effect.

---

## 4. Blueprint illustrations

Every explanatory drawing is an inline SVG on blueprint paper. They live in
`src/pages/home/ui/illustrations.tsx`.

- **Paper**: `.blueprint`: opaque `rgb(21 70 49)` with a 16px grid of
  `rock/6%` lines, inside a `border border-rock/15` box, padded `p-4 md:p-6`.
- **Canvas**: `viewBox="0 0 320 160"`, `class="bp"`, 10px Grotesk labels.
- **Stroke classes** (all 1px, `non-scaling-stroke`):

| Class                                  | Look           | Meaning                                             |
| -------------------------------------- | -------------- | --------------------------------------------------- |
| _(default)_                            | `rock/55` line | Structure                                           |
| `.soft`                                | `rock/25` line | Axes, guides, secondary                             |
| `.accent`                              | lichen line    | The thing that matters, the active or ordered path  |
| `.amber`                               | amber line     | A threat or signal (the front-runner, the playhead) |
| `.dash`                                | 3/3 dash       | Pending, proposed, a proof bracket                  |
| `.fill` / `.fill-amber` / `.fill-rock` | solid          | Settled items, dots                                 |
| `text.hi`                              | amber text     | The one label to read first                         |

- **Draw the real mechanism.** A drawing should explain what happens
  (queues, matches, hashes, settlement), not illustrate a mood. Label it like
  a diagram, in lowercase.
- **One accent story per drawing.** Lichen for the path that matters, at most
  one amber element.
- Give the SVG a `role="img"` and an `aria-label` that states what it shows.

### Motion in drawings

Animation is plain CSS on the `a-*` classes in `landing.css`. The `Blueprint`
wrapper sets `data-inview` so animations only run while on screen, and all
of them are removed under `prefers-reduced-motion`.

| Class                                                     | Motion                                                         | Typical use                     |
| --------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------- |
| `a-queue` / `a-leave` / `a-join`                          | The queue advances one slot, the front leaves, a new one joins | FIFO queues                     |
| `a-log`                                                   | Ordered log slides one item along                              | Sequencer output                |
| `a-flow`                                                  | Dashes travel along a wire                                     | Data or orders flowing          |
| `a-pulse`                                                 | A dot travels a wire (`--dx`, `--dy`, `--delay`)               | Liquidity moving between nodes  |
| `a-cutter` + `a-block`                                    | Something drops, hits a barrier, an X appears                  | Front-running blocked           |
| `a-playhead`, `a-confirm-now`, `a-confirm-late`, `a-wait` | Timeline sweep with two confirmations                          | Finality comparison             |
| `a-breathe`                                               | Opacity breath                                                 | The node everything connects to |
| `a-draw`                                                  | Line draws itself once                                         | Charts, roadmaps                |
| `a-blink`                                                 | Stepped blink                                                  | The destination point           |

Loops are short (0.7–3 s) and seamless: the end state of a loop must look
identical to its start.

---

## 5. Components

- **Primary button**: `bg-amber-200 px-5 py-3 font-medium text-dark-forest
hover:bg-amber-100`. Square, no icon. One per view.
- **Secondary action**: a text link with `.link` (underline `rock/30`, amber
  on hover). Never a second filled button.
- **Header**: `.glass-nav`, which is translucent forest, 14px blur and a 2px
  checker dither grain fading downward. It sits under the page's noise
  overlay so it takes the same texture. Nav items are ruled cells
  (`border-l border-rock/15`, `hover:bg-white/5`), and the waitlist cell is
  amber text.
- **Linked cards**: `.dither-corner group`. Hover brings the live dither
  glow, and the `.card-arrow` (48–64px amber arrow) springs in and nudges
  toward the link. On touch screens the arrow is always visible.
- **Captions on fields**: small chips, `border border-rock/25 bg-dark-forest
px-2.5 py-1 text-xs text-rock/70`, pinned top-left and bottom-right, and
  read as one sentence across the two.
- **Noise overlay**: `NoiseOverlay` (fractal-noise SVG, `soft-light`, fixed,
  `z-10`) sits over the page, including the header. It is what makes flat forest
  feel like paper.

### Terminal demo

`src/pages/home/ui/demo/` is a scripted replica of `/perps`, rendered at a
fixed design size (1200×720, or 640×720 compact) and scaled to fit.

- Keep it faithful to the real app: same labels ("Buy / Long", "Sell / Short",
  "Positions", "Market"), same trading colours, same toast.
- Keep the landing's frame: forest window, rock text, opaque borders, serif
  wordmark.
- Everything is simulated locally. Never call real APIs from it.
- The market ticks only while it is on screen, and the script pauses with it.

---

## 6. Motion

- **Easing**
  - Entrances: `cubic-bezier(0.22, 1, 0.36, 1)` (fast out, long settle).
  - Loops that move and hold: `cubic-bezier(0.65, 0, 0.35, 1)`.
  - Springy pops (arrows, confirmations): `cubic-bezier(0.34, 1.56, 0.64, 1)`.
- **Physics over tweens** in canvas: under-damped springs so things overshoot
  slightly and settle.
- **Hero intro** is pure CSS (`[data-intro]`, 0.7s rise and fade, 0.12s
  stagger), so it runs on first paint without JS.
- **Budget**: nothing animates offscreen, nothing loops faster than 0.7 s,
  and no more than one large moving field is on screen at a time.
- **Reduced motion**: every animation has a still state. Canvases draw one
  frame, CSS loops stop, and the demo shows an open position without a
  cursor.

---

## 7. Do and don't

**Do**

- Start from `dark-forest` and `rock`, and add lichen or amber only where it
  means something.
- Explain with drawings. If a section makes a claim, draw the mechanism.
- Let dither fade; let rules cross the frame; mark the crossings.
- Keep copy short, specific and in sentence case.

**Don't**

- Use pure white, pure black, or greys that aren't rock-at-opacity.
- Use red or green outside the terminal demo.
- Add blurred colour blobs, radial glows or gradient washes. Use dither
  instead.
- Round corners, add drop shadows to cards, or use icon-in-a-circle feature
  blocks.
- Put a second filled button next to the primary.
- Ship an animation without an offscreen pause and a reduced-motion state.

---

## File map

```
src/index.css                        tokens: colours, font families
src/pages/home/
  landing.css                        frame, reg marks, dither, blueprint, a-* motion, demo
  index.tsx                          page shell (.landing, header, sections, noise)
  lib/
    dither.ts                        Bayer, packColor, ditherLevel, clock
    logo-field.ts                    hero mark
    orderbook-field.ts               order book field
    dither-hover.ts                  card hover glow
    useInView.ts                     data-inview + whenNear
  ui/
    illustrations.tsx                blueprint drawings
    demo/                            terminal demo (market sim, panels, script)
public/dither/                       pre-rendered Bayer bands and corner
public/og.jpg                        1200×630 social card rendered from the hero
```
