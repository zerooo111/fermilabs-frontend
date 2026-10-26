#!/usr/bin/env node
// Capture FLP data API responses as test fixtures (src/features/flp-vault/model/__fixtures__).
// Re-run when the API's shape changes:  node scripts/flp-fixtures.mjs
// Fresh reads can take 40 s; the files are written as they arrive.
import { writeFileSync } from 'node:fs';

const API = process.env.FLP_API_URL ?? 'https://flp.34-116-238-207.sslip.io';
const DIR = 'src/features/flp-vault/model/__fixtures__';
// RC6 has one vault, already live: its captures replace live*.json. The
// pre-deposit*.json captures stay from RC4 (vault 3 8fAq…, program 5EJSS…)
// until an RC6 vault runs a pre-deposit phase.
const PRE = process.env.FLP_FIXTURE_PRE_VAULT; // unset: keep the RC4 pre-deposit captures
const LIVE = 'DSF7hKayWatQyRhuyr4UkrG3zUuNW6b1Q5VhW7BzrUhu'; // RC6 vault
// A devnet wallet with shares in the RC6 vault and direct-deposit approval.
const WALLET = process.env.FLP_FIXTURE_WALLET ?? 'CSYxXfixXywMcTGECWjiJdoD75gtzU67fA8JR6YqFvha';
// A wallet with no Depositor record (user: null).
const NOBODY = 'Fermi111111111111111111111111111111111111111';

const shots = {
  ...(PRE && {
    'pre-deposit.json': `/state/vaults/${PRE}`,
    'pre-deposit-user.json': `/state/vaults/${PRE}/users/${WALLET}`,
    'pre-deposit-nouser.json': `/state/vaults/${PRE}/users/${NOBODY}`,
  }),
  'live.json': `/state/vaults/${LIVE}`,
  'live-user.json': `/state/vaults/${LIVE}/users/${WALLET}`,
};

await Promise.all(
  Object.entries(shots).map(async ([file, path]) => {
    const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    const body = await res.json();
    delete body.cache; // per-request noise
    writeFileSync(`${DIR}/${file}`, `${JSON.stringify(body, null, 2)}\n`);
    console.log('wrote', file);
  })
);
