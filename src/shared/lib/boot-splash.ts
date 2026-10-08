/**
 * boot-splash.ts
 * Removes the boot splash (#boot-splash in index.html) once the app has
 * something to show.
 */

// Must match the boot-in animation in index.html: invisible for SHOW_AT ms,
// then shown for at least MIN_VISIBLE ms so it never flashes.
const SHOW_AT = 150;
const MIN_VISIBLE = 400;
const FADE_MS = 280;

let done = false;

export function hideBootSplash(): void {
  if (done) return;
  done = true;

  const el = document.getElementById('boot-splash');
  if (!el) return;

  // Time since the splash's appear animation started, delay included. Once it
  // has finished its clock stops, so fall back to time since navigation.
  const appear = el.getAnimations?.()[0];
  const elapsed =
    appear && appear.playState !== 'finished' ? Number(appear.currentTime) : performance.now();

  // Not shown yet: drop it unseen, so warm loads go straight to the app.
  if (elapsed < SHOW_AT) {
    el.remove();
    return;
  }

  window.setTimeout(
    () => {
      el.classList.add('is-done');
      el.addEventListener('animationend', () => el.remove(), { once: true });
      // animationend never fires while the tab is hidden
      window.setTimeout(() => el.remove(), FADE_MS + 300);
    },
    Math.max(0, SHOW_AT + MIN_VISIBLE - elapsed)
  );
}
