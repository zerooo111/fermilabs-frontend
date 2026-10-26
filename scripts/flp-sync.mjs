#!/usr/bin/env node
// Check the FLP integration against the protocol team's RC6 devnet records,
// and optionally re-vendor the SDK.
//
//   pnpm flp:sync           report drift (exit 1 if any)
//   pnpm flp:sync --write   re-vendor sdk/src + sdk/idl (+ the trimmed core IDL)
//                           from fermi-v1 main, verified against the RC6 IDL hash
//
// Sources (fermi-v1 main, kept current by the protocol team):
// - flp-vault/docs/INTEGRATION_GUIDE.md "Devnet — RC6 vanity deployment" table
//   (vault program, core program, target vault);
// - flp-vault/mainnet/rc6/devnet/<date>-runtime-artifact.json (the devnet pins);
// - the canonical IDL hash at the top of the guide (RC6_RELEASE.idlSha256).
// The data API host's /deployment.json is checked too, once it describes RC6.
// Addresses in config.ts are reported, not rewritten: change them by hand.
// Needs `gh` (authenticated); fermi-v1 may be private.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const API = process.env.FLP_API_URL ?? 'https://flp.34-116-238-207.sslip.io';
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

const config = readFileSync(CONFIG, 'utf8');
const vendor = JSON.parse(readFileSync(`${SDK}/VENDOR.json`, 'utf8'));
const drift = [];
const has = (label, address) => {
  if (!address) drift.push(`${label}: not found in the protocol records`);
  else if (!config.includes(address))
    drift.push(`${label}: records have ${address}, not in config.ts`);
};

// The devnet table of the integration guide.
const guide = raw('flp-vault/docs/INTEGRATION_GUIDE.md').toString();
const row = name =>
  guide.match(new RegExp(`\\| ${name} \\| \`([1-9A-HJ-NP-Za-km-z]{32,44})\` \\|`))?.[1];
has('vault program', row('Vault program'));
has('core program', row('Core program'));
has('RC6 vault', row('Target vault PDA'));
const idlSha = guide.match(/canonical IDL SHA-256 is `([0-9a-f]{64})`/)?.[1];
if (!idlSha) drift.push('canonical IDL hash: not found in the integration guide');

// The newest runtime artifact receipt must name the same programs.
const receipts = JSON.parse(
  gh(['api', `repos/${REPO}/contents/flp-vault/mainnet/rc6/devnet?ref=main`]).toString()
)
  .map(f => f.name)
  .filter(n => n.endsWith('-runtime-artifact.json'))
  .sort();
const receipt = receipts.length
  ? JSON.parse(raw(`flp-vault/mainnet/rc6/devnet/${receipts.at(-1)}`).toString())
  : null;
if (!receipt) drift.push('runtime artifact receipt: none in flp-vault/mainnet/rc6/devnet');
else {
  has(`vault program (${receipts.at(-1)})`, receipt.vaultProgram);
  has(`devnet core program (${receipts.at(-1)})`, receipt.devnetRuntimeCore?.program);
}

// The data API host's manifest, once it serves this program.
const manifest = await fetch(`${API}/deployment.json`, { signal: AbortSignal.timeout(60_000) })
  .then(r => (r.ok ? r.json() : null))
  .catch(() => null);
const manifestCurrent = manifest?.programs?.vault && config.includes(manifest.programs.vault);
if (manifestCurrent) {
  // Every listed market needs base decimals in config.ts; the RC6 manifest
  // doesn't give them (read them from the PerpMarket), earlier ones did.
  for (const m of manifest.markets ?? []) {
    const wanted = m.baseDecimals ?? '\\d+';
    if (!new RegExp(`\\b${m.index}: ${wanted}\\b`).test(config))
      drift.push(
        `market ${m.index} (${m.name}): base decimals ${m.baseDecimals ?? '?'} not in config.ts`
      );
  }
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
    `data API manifest ${manifestCurrent ? 'describes this deployment' : 'still describes another deployment'}`
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
