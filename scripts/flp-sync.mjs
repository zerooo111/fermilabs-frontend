#!/usr/bin/env node
// Check the FLP integration against the protocol team's RC6.1 mainnet records,
// and optionally re-vendor the SDK.
//
//   pnpm flp:sync           report drift (exit 1 if any)
//   pnpm flp:sync --write   re-vendor sdk/src + sdk/idl (+ the trimmed core IDL)
//                           from fermi-v1 main, verified against the RC6 IDL hash
//
// Sources (fermi-v1 main, kept current by the protocol team):
// - flp-vault/docs/INTEGRATION_GUIDE.md "Mainnet — RC6.1" table
//   (vault program, core program, group, vault);
// - flp-vault/docs/mainnet-rc6.1.json, also served by the mainnet reader at
//   /deployment.json (the deployed ELF, markets);
// - the canonical IDL hash at the top of the guide (RC6_RELEASE.idlSha256).
// config.ts takes its addresses from the vendored SDK's RC6_MAINNET_RELEASE,
// so the checks run against both. Market decimals are reported, not
// rewritten: change them by hand.
// Needs `gh` (authenticated); fermi-v1 may be private.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const API = process.env.FLP_API_URL ?? 'https://flp-mainnet.34-116-238-207.sslip.io';
const REPO = 'Fermi-DEX/fermi-v1';
const SDK = 'src/features/flp-vault/sdk';
const CONFIG = 'src/features/flp-vault/model/config.ts';
const write = process.argv.includes('--write');

const sha = buf => createHash('sha256').update(buf).digest('hex');
const gh = args => execFileSync('gh', args, { maxBuffer: 64 * 1024 * 1024 });
const raw = path =>
  gh([
    'api',
    `repos/${REPO}/contents/${path}?ref=main`,
    '-H',
    'Accept: application/vnd.github.raw',
  ]);
const commit = gh(['api', `repos/${REPO}/commits/main`, '--jq', '.sha'])
  .toString()
  .trim();

// The pins config.ts reads (RC6_MAINNET_RELEASE in the vendored v4 entry) count as config.
const config = readFileSync(CONFIG, 'utf8') + readFileSync(`${SDK}/src/v4.ts`, 'utf8');
const vendor = JSON.parse(readFileSync(`${SDK}/VENDOR.json`, 'utf8'));
const drift = [];
const has = (label, address) => {
  if (!address) drift.push(`${label}: not found in the protocol records`);
  else if (!config.includes(address))
    drift.push(`${label}: records have ${address}, not in config.ts`);
};

// The mainnet section of the integration guide (its first table).
const guide = raw('flp-vault/docs/INTEGRATION_GUIDE.md').toString();
const mainnet = guide.slice(guide.indexOf('## Mainnet'), guide.indexOf('## Devnet'));
const row = name =>
  mainnet.match(new RegExp(`\\| ${name}[^|]* \\| \`([1-9A-HJ-NP-Za-km-z]{32,44})\``))?.[1];
has('vault program', row('Vault program'));
has('core program', row('Core program'));
has('group', row('Group'));
has('mainnet vault', row('Vault \\(vault ID 1\\)'));
const idlSha = guide.match(/canonical IDL SHA-256 is `([0-9a-f]{64})`/)?.[1];
if (!idlSha) drift.push('canonical IDL hash: not found in the integration guide');

// The machine-readable deployment record, and the reader's copy of it.
const record = JSON.parse(raw('flp-vault/docs/mainnet-rc6.1.json').toString());
const manifest = await fetch(`${API}/deployment.json`, { signal: AbortSignal.timeout(60_000) })
  .then(r => (r.ok ? r.json() : null))
  .catch(() => null);
if (!manifest) drift.push(`${API}/deployment.json: unreachable`);
else if (JSON.stringify(manifest) !== JSON.stringify(record))
  drift.push(`${API}/deployment.json differs from docs/mainnet-rc6.1.json`);
has('vault program (record)', record.programs?.vault);
has('core program (record)', record.programs?.core);
has('mainnet vault (record)', record.accounts?.vault);
if (record.programs?.vaultElfSha256 && !config.includes(record.programs.vaultElfSha256))
  drift.push(`deployed ELF ${record.programs.vaultElfSha256}: not the vendored RC6_MAINNET_RELEASE pin`);
if (idlSha && record.programs?.idlSha256 !== idlSha)
  drift.push('the deployment record and the guide name different IDL hashes');
// Every market needs base decimals in config.ts; the record doesn't give
// them (they're in each PerpMarket account; the reader's /state/markets has them).
const markets = await fetch(`${API}/state/markets`, { signal: AbortSignal.timeout(60_000) })
  .then(r => (r.ok ? r.json() : null))
  .catch(() => null);
for (const m of record.markets ?? []) {
  const decimals = markets?.items?.find(i => Number(i.market) === m.index)?.metadata?.base_decimals;
  if (!new RegExp(`\\b${m.index}: ${decimals ?? '\\d+'}\\b`).test(config))
    drift.push(`market ${m.index} (${m.symbol}): base decimals ${decimals ?? '?'} not in config.ts`);
}

// Vendored files: on disk vs VENDOR.json vs fermi-v1 main.
const FILES = ['src/index.ts', 'src/v4.ts', 'idl/flp_vault.json', 'idl/flp_vault_v4.json'];
const upstream = Object.fromEntries(FILES.map(f => [f, raw(`flp-vault/sdk/${f}`)]));
for (const file of FILES) {
  let actual = null;
  try {
    actual = sha(readFileSync(`${SDK}/${file}`));
  } catch {
    drift.push(`${file}: missing`);
    continue;
  }
  if (actual !== vendor.files[file])
    drift.push(`${file}: edited locally (hash differs from VENDOR.json)`);
  if (actual !== sha(upstream[file])) drift.push(`${file}: fermi-v1 main has a newer copy`);
}
if (idlSha && sha(upstream['idl/flp_vault_v4.json']) !== idlSha)
  drift.push(
    'idl/flp_vault_v4.json on fermi-v1 main does not match the guide’s canonical IDL hash'
  );

const sdkDrift = drift.some(d => /^(src|idl)\//.test(d));
if (write && sdkDrift) {
  if (idlSha && sha(upstream['idl/flp_vault_v4.json']) !== idlSha)
    throw new Error('fermi-v1 main does not match the RC6 IDL hash yet; try again later');
  mkdirSync(`${SDK}/src`, { recursive: true });
  mkdirSync(`${SDK}/idl`, { recursive: true });
  for (const file of FILES) writeFileSync(`${SDK}/${file}`, upstream[file]);
  writeFileSync(`${SDK}/fermi_core_accounts.json`, trimCoreIdl(JSON.parse(raw('mango_v4.json'))));
  vendor.commit = commit;
  vendor.vendoredAt = new Date().toISOString().slice(0, 10);
  vendor.files = Object.fromEntries(FILES.map(f => [f, sha(upstream[f])]));
  writeFileSync(`${SDK}/VENDOR.json`, `${JSON.stringify(vendor, null, 2)}\n`);
  console.log(
    `re-vendored the SDK from ${REPO}@${commit.slice(0, 8)}; run pnpm typecheck && pnpm test`
  );
  process.exit(drift.filter(d => !/^(src|idl)\//.test(d)).length ? 1 : 0);
}

console.log(
  `fermi-v1 main ${commit.slice(0, 8)}; vendored ${vendor.commit.slice(0, 8)} (${vendor.vendoredAt}); ` +
    `reader ${API}`
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
