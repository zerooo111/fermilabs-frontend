/**
 * Points docs page — renders alien-points.md. Edit the Markdown to change the
 * page; figures referenced as `images/<name>` load from public/points/docs/images.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';
import { PointsShell } from '../ui/PointsShell';
import { MarkdownDoc } from './ui/MarkdownDoc';
import { parseDoc } from './lib/parseDoc';
import { useActiveHeading } from './lib/useActiveHeading';
import source from './alien-points.md?raw';
import './points-docs.css';

const doc = parseDoc(source);

const tocIds = doc.toc.map(item => item.id);

const READER_INPUT = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

function PointsDocsPage() {
  const { hash } = useLocation();
  const activeId = useActiveHeading(tocIds);
  const mobileToc = useRef<HTMLDetailsElement>(null);
  const activeText = doc.toc.find(item => item.id === activeId)?.text;

  useEffect(() => {
    const prevTitle = document.title;
    if (doc.title) document.title = `${doc.title} · Fermi Trade`;
    return () => {
      document.title = prevTitle;
    };
  }, []);

  // The page mounts after its chunk loads, too late for the browser's own jump.
  // Figures and fonts then shift the layout, so keep the target in place until
  // it settles or the reader takes over.
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!target) return;

    const jump = () => target.scrollIntoView();
    jump();

    const observer = new ResizeObserver(jump);
    observer.observe(document.body);
    const stop = () => {
      observer.disconnect();
      clearTimeout(timer);
      READER_INPUT.forEach(type => window.removeEventListener(type, stop));
    };
    const timer = setTimeout(stop, 2000);
    READER_INPUT.forEach(type => window.addEventListener(type, stop, { passive: true }));
    return stop;
  }, [hash]);

  return (
    <PointsShell>
      {/* minmax(0,1fr) on mobile too, or wide tables and code size the column past the screen */}
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Full-height rule between contents and doc, like the frame's own sides */}
        <nav aria-label="On this page" className="border-r border-rock/15 max-lg:hidden">
          <div className="sticky top-14 px-8 py-12">
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.15em] text-rock/50">
              On this page
            </p>
            <ul className="border-l border-rock/15 text-sm">
              {doc.toc.map(item => {
                const isActive = item.id === activeId;
                return (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      aria-current={isActive ? 'location' : undefined}
                      className={cn(
                        '-ml-px block border-l py-1.5 pl-4 leading-snug transition-colors duration-150 hover:text-amber-100',
                        isActive ? 'border-amber-200 text-rock' : 'border-transparent text-rock/55'
                      )}
                    >
                      {item.text}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        <div className="px-5 py-12 md:px-10 md:py-16 lg:px-14">
          {/* Below lg the side contents is hidden; a sticky bar under the header stands in.
              It sits in the doc column so it stays stuck for the whole page. */}
          <details
            ref={mobileToc}
            className="group sticky top-14 z-[4] -mx-5 -mt-12 mb-10 border-b border-rock/15 bg-background md:-mx-10 md:-mt-16 lg:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-3 md:px-10 [&::-webkit-details-marker]:hidden">
              <span className="shrink-0 font-mono text-xs uppercase tracking-[0.15em] text-rock/50">
                On this page
              </span>
              <span className="min-w-0 flex-1 truncate text-right text-sm text-rock/80">
                {activeText}
              </span>
              <span
                aria-hidden
                className="shrink-0 font-mono text-xs text-rock/50 transition-transform duration-150 group-open:rotate-180"
              >
                ▾
              </span>
            </summary>
            <ul className="max-h-[60vh] overflow-y-auto border-t border-rock/15 px-5 py-2 text-sm md:px-10">
              {doc.toc.map(item => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    aria-current={item.id === activeId ? 'location' : undefined}
                    onClick={() => mobileToc.current?.removeAttribute('open')}
                    className={cn(
                      'block py-2 leading-snug',
                      item.id === activeId ? 'text-amber-200' : 'text-rock/70'
                    )}
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </details>
          <MarkdownDoc body={doc.body} />
        </div>
      </div>
    </PointsShell>
  );
}

export default PointsDocsPage;
