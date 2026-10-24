#!/usr/bin/env node
// Check the FLP integration against the live deployment manifest, and
// optionally re-vendor the SDK.
//
//   pnpm flp:sync           report drift (exit 1 if any)
//   pnpm flp:sync --write   re-vendor sdk/src + sdk/idl (+ the trimmed core IDL)
//                           from fermi-v1, verified against the manifest hashes
//
// The protocol team updates the manifest on every frontend-relevant change
// (fermi-v1 flp-vault/docs/INTEGRATION_GUIDE.md). Addresses in config.ts are
// reported, not rewritten: change them by hand and re-run.
// Needs `gh` (authenticated) for --write; fermi-v1 may be private.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const API = process.env.FLP_API_URL ?? 'https://flp.34-116-238-207.sslip.io';
const REPO = 'Fermi-DEX/fermi-v1';
const SDK = 'src/features/flp-vault/sdk';
const CONFIG = 'src/features/flp-vault/model/config.ts';
const write = process.argv.includes('--write');

const sha = buf => createHash('sha256').update(buf).digest('hex');
const manifest = await (
  await fetch(`${API}/deployment.json`, { signal: AbortSignal.timeout(60_000) })
).json();
const config = readFileSync(CONFIG, 'utf8');
const vendor = JSON.parse(readFileSync(`${SDK}/VENDOR.json`, 'utf8'));
const drift = [];

// Addresses the app hardcodes.
const has = (label, address) => {
  if (address && !config.includes(address))
    drift.push(`${label}: manifest has ${address}, not in config.ts`);
};
has('vault program', manifest.programs?.vault);
has('core program', manifest.programs?.core);
has('pre-deposit vault', manifest.vaults?.predeposit?.vault);
has('live vault', manifest.vaults?.live?.vault);
for (const m of manifest.markets ?? []) {
  if (!new RegExp(`\\b${m.index}: ${m.baseDecimals}\\b`).test(config))
    drift.push(
      `market ${m.index} (${m.name}): baseDecimals ${m.baseDecimals} not in FLP_MARKET_BASE_DECIMALS`
    );
}

// Vendored files: on disk vs VENDOR.json vs manifest.
const files = {
  'src/index.ts': manifest.sdk?.indexTsSha256,
  'idl/flp_vault.json': manifest.idl?.sha256,
};
for (const [file, wanted] of Object.entries(files)) {
  const actual = sha(readFileSync(`${SDK}/${file}`));
  if (actual !== vendor.files[file])
    drift.push(`${file}: edited locally (hash differs from VENDOR.json)`);
  if (wanted && actual !== wanted)
    drift.push(`${file}: manifest wants ${wanted.slice(0, 12)}…, vendored ${actual.slice(0, 12)}…`);
}

const sdkDrift = drift.some(d => d.startsWith('src/') || d.startsWith('idl/'));
if (write && sdkDrift) {
  const raw = path =>
    execFileSync(
      'gh',
      [
        'api',
        `repos/${REPO}/contents/${path}?ref=main`,
        '-H',
        'Accept: application/vnd.github.raw',
      ],
      {
        maxBuffer: 64 * 1024 * 1024,
      }
    );
  const commit = execFileSync('gh', ['api', `repos/${REPO}/commits/main`, '--jq', '.sha'])
    .toString()
    .trim();
  const src = raw('flp-vault/sdk/src/index.ts');
  const idl = raw('flp-vault/sdk/idl/flp_vault.json');
  if (sha(src) !== files['src/index.ts'] || sha(idl) !== files['idl/flp_vault.json'])
    throw new Error('fermi-v1 main does not match the manifest hashes yet; try again later');
  mkdirSync(`${SDK}/src`, { recursive: true });
  mkdirSync(`${SDK}/idl`, { recursive: true });
  writeFileSync(`${SDK}/src/index.ts`, src);
  writeFileSync(`${SDK}/idl/flp_vault.json`, idl);
  writeFileSync(`${SDK}/fermi_core_accounts.json`, trimCoreIdl(JSON.parse(raw('mango_v4.json'))));
  vendor.commit = commit;
  vendor.vendoredAt = new Date().toISOString().slice(0, 10);
  vendor.files = { 'src/index.ts': sha(src), 'idl/flp_vault.json': sha(idl) };
  writeFileSync(`${SDK}/VENDOR.json`, `${JSON.stringify(vendor, null, 2)}\n`);
  console.log(
    `re-vendored the SDK from ${REPO}@${commit.slice(0, 8)}; run pnpm typecheck && pnpm test`
  );
  process.exit(
    drift.length - drift.filter(d => d.startsWith('src/') || d.startsWith('idl/')).length ? 1 : 0
  );
}

console.log(
  `manifest updated ${manifest.updatedAt ?? '?'}; vendored ${vendor.commit.slice(0, 8)} (${vendor.vendoredAt})`
);
if (!drift.length) {
  console.log('flp:sync: in sync');
} else {
  console.error(drift.map(d => `  - ${d}`).join('\n'));
  console.error(
    sdkDrift
      ? '\nflp:sync: drift found; `pnpm flp:sync --write` re-vendors the SDK'
      : '\nflp:sync: drift found'
  );
  process.exit(1);
}

/** Keep the core IDL accounts the FLP pricing code decodes, with their type closure. */
function trimCoreIdl(idl) {
  const want = ['FermiAccount', 'Bank', 'PerpMarket'];
  const types = new Map(idl.types.map(t => [t.name, t]));
  const need = new Set();
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.defined === 'string' && !need.has(node.defined)) {
      need.add(node.defined);
      walk(types.get(node.defined));
    }
    Object.values(node).forEach(walk);
  };
  const accounts = idl.accounts.filter(a => want.includes(a.name));
  accounts.forEach(walk);
  return JSON.stringify({
    version: idl.version,
    name: idl.name,
    instructions: [],
    accounts,
    types: idl.types.filter(t => need.has(t.name)),
  });
}
