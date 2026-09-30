/**
 * /design-system. The reference for Fermi's color tokens. Every swatch and
 * contrast ratio is read from src/index.css at runtime.
 */
import { Example, Migration } from './ui/InPractice';
import { Primitives, Rules, WhyOpaque } from './ui/Foundations';
import { BrandContext, Foreground, Lines, States, Status, Surfaces } from './ui/Semantics';

const NAV = [
  ['rules', 'Rules'],
  ['why', 'Why'],
  ['primitives', 'Primitives'],
  ['surfaces', 'Surfaces'],
  ['foreground', 'Foreground'],
  ['lines', 'Lines'],
  ['states', 'States'],
  ['status', 'Status'],
  ['brand', 'Brand'],
  ['example', 'Example'],
  ['migration', 'Migration'],
];

function DesignSystemPage() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-surface-canvas px-4 py-10 md:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[160px_1fr]">
        <nav aria-label="Sections" className="hidden lg:block">
          <ul className="sticky top-8 flex flex-col gap-0.5 border-l border-line-subtle">
            {NAV.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="-ml-px block border-l border-transparent py-1 pl-3 text-sm text-fg-tertiary hover:border-line-strong hover:text-fg-primary"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0">
          <header className="pb-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-tertiary">
              Fermi design system
            </p>
            <h1 className="mt-3 font-display text-5xl text-fg-primary md:text-6xl">Color</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-fg-secondary">
              One neutral ramp built from our forest green and rock cream, named by job. Surfaces
              are opaque, states are translucent, and every text token is checked against every
              surface it can land on. Click any token name to copy it.
            </p>
          </header>

          <Rules />
          <WhyOpaque />
          <Primitives />
          <Surfaces />
          <Foreground />
          <Lines />
          <States />
          <Status />
          <BrandContext />
          <Example />
          <Migration />
        </main>
      </div>
    </div>
  );
}

export default DesignSystemPage;
