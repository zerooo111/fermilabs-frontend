/**
 * useActiveHeading.ts
 * Scroll spy for the table of contents: the section whose heading last passed
 * under the sticky header is the one being read.
 */
import { useEffect, useState } from 'react';

// Sticky header (h-14) plus some reading room below it
const OFFSET = 120;

export function useActiveHeading(ids: string[]): string | undefined {
  const [active, setActive] = useState<string>();

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) {
        setActive(ids[ids.length - 1]);
        return;
      }
      let current: string | undefined;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el || el.getBoundingClientRect().top > OFFSET) break;
        current = id;
      }
      setActive(current);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ids]);

  return active;
}
