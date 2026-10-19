/**
 * Points docs page — renders alien-points.md. Edit the Markdown to change the
 * page; figures referenced as `images/<name>` load from public/points/docs/images.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PointsShell } from '../ui/PointsShell';
import { MarkdownDoc } from './ui/MarkdownDoc';
import { parseDoc } from './lib/parseDoc';
import source from './alien-points.md?raw';
import './points-docs.css';

const doc = parseDoc(source);

function PointsDocsPage() {
  const { hash } = useLocation();

  useEffect(() => {
    const prevTitle = document.title;
    if (doc.title) document.title = `${doc.title} · Fermi Trade`;
    return () => {
      document.title = prevTitle;
    };
  }, []);

  // The page mounts after its chunk loads, too late for the browser's own jump
  useEffect(() => {
    if (!hash) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [hash]);

  return (
    <PointsShell>
      <div className="grid gap-10 px-5 py-12 md:px-10 md:py-16 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="max-lg:hidden">
          <div className="sticky top-24">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.15em] text-rock/50">
              On this page
            </p>
            <ul className="space-y-2 text-sm">
              {doc.toc.map(item => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="text-rock/60 transition-colors duration-150 hover:text-amber-100"
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <MarkdownDoc body={doc.body} />
      </div>
    </PointsShell>
  );
}

export default PointsDocsPage;
