/**
 * Points docs page — renders alien-points.md. Edit the Markdown to change the
 * page; figures referenced as `images/<name>` load from public/points/docs/images.
 */
import { useEffect } from 'react';
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
      <div className="grid lg:grid-cols-[260px_minmax(0,1fr)]">
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
          <MarkdownDoc body={doc.body} />
        </div>
      </div>
    </PointsShell>
  );
}

export default PointsDocsPage;
