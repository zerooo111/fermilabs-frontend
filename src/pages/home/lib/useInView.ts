import { useEffect, useRef } from 'react';

/**
 * Mirrors whether the element is on screen into its `data-inview` attribute,
 * without re-rendering, so CSS can pause animations while it's off screen.
 */
export function useInView<T extends Element>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      el.setAttribute('data-inview', String(entry.isIntersecting));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

/** Run `load` once the element comes within 200px of the viewport. */
export function whenNear(el: Element, load: () => void) {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      load();
    },
    { rootMargin: '200px' }
  );
  observer.observe(el);
  return () => observer.disconnect();
}
