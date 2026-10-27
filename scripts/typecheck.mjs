#!/usr/bin/env node
// Type-check the app (tsconfig.app.json) against a baseline of known errors.
//
//   pnpm typecheck            fail on any error not in typecheck-baseline.json
//   pnpm typecheck --update   rewrite the baseline (after fixing known errors)
//
// The root tsconfig.json only holds project references, so a bare
// `tsc --noEmit` checks nothing. Baseline entries ignore line numbers, so
// unrelated edits to a file don't break them; counts per message still do.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const BASELINE = 'typecheck-baseline.json';
let out = '';
try {
  out = execFileSync(
    'pnpm',
    ['exec', 'tsc', '-p', 'tsconfig.app.json', '--noEmit', '--pretty', 'false'],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
} catch (err) {
  out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
}

const lines = out.split('\n').filter(l => / error TS\d+:/.test(l));
const key = l => l.replace(/\(\d+,\d+\)/, '');
const counts = {};
for (const l of lines) counts[key(l)] = (counts[key(l)] ?? 0) + 1;

if (process.argv.includes('--update')) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(BASELINE, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`typecheck: baseline updated, ${lines.length} known errors`);
  process.exit(0);
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const fresh = lines.filter(l => {
  const k = key(l);
  if ((baseline[k] ?? 0) > 0) {
    baseline[k] -= 1;
    return false;
  }
  return true;
});
const fixed = Object.values(baseline).reduce((a, n) => a + n, 0);

if (fresh.length) {
  console.error(fresh.join('\n'));
  console.error(
    `\ntypecheck: ${fresh.length} new error(s). Fix them; baseline errors don't count.`
  );
  process.exit(1);
}
console.log(
  `typecheck: no new errors (${lines.length} known in ${BASELINE}${fixed ? `; ${fixed} fixed, run with --update` : ''})`
);
