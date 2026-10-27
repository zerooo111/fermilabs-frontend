#!/usr/bin/env node
// Capture FLP data API responses as test fixtures (src/features/flp-vault/model/__fixtures__).
// Re-run when the API's shape changes:  node scripts/flp-fixtures.mjs
// Fresh reads can take 40 s; the files are written as they arrive.
import { writeFileSync } from 'node:fs';

const MAINNET_API = process.env.FLP_API_URL ?? 'https://flp-mainnet.34-116-238-207.sslip.io';
const DEVNET_API = 'https://flp.34-116-238-207.sslip.io';
const DIR = 'src/features/flp-vault/model/__fixtures__';
// mainnet*.json: the RC6.1 mainnet vault, in pre-deposit with public intake
// paused. live*.json are the RC6 devnet vault (live phase, which mainnet
// hasn't reached) and are re-captured only with FLP_FIXTURE_DEVNET=1.
// pre-deposit*.json stay RC4 captures (vault 3 8fAq…, program 5EJSS…): an
// approved wallet holding both principal and shares, a state neither RC6 vault is in.
const MAINNET = '8aHdjxJzec6CfBngSFZYQvqZsBtXWXG6j1C3rW799pbP';
// The approved funding wallet (mainnet-deployed-rc6.1.md "Roles").
const MAINNET_WALLET = 'C72X2LJ8DbBYawwMcWr7qF9emiRQdbCTZGEpAhjGZQqx';
const LIVE = 'DSF7hKayWatQyRhuyr4UkrG3zUuNW6b1Q5VhW7BzrUhu'; // RC6 devnet vault
// A devnet wallet with shares in the RC6 vault and direct-deposit approval.
const WALLET = process.env.FLP_FIXTURE_WALLET ?? 'CSYxXfixXywMcTGECWjiJdoD75gtzU67fA8JR6YqFvha';
// A wallet with no Depositor record (user: null).
const NOBODY = 'Fermi111111111111111111111111111111111111111';

const shots = {
  'mainnet.json': `${MAINNET_API}/state/vaults/${MAINNET}`,
  'mainnet-user.json': `${MAINNET_API}/state/vaults/${MAINNET}/users/${MAINNET_WALLET}`,
  'mainnet-nouser.json': `${MAINNET_API}/state/vaults/${MAINNET}/users/${NOBODY}`,
  ...(process.env.FLP_FIXTURE_DEVNET && {
    'live.json': `${DEVNET_API}/state/vaults/${LIVE}`,
    'live-user.json': `${DEVNET_API}/state/vaults/${LIVE}/users/${WALLET}`,
  }),
};

await Promise.all(
  Object.entries(shots).map(async ([file, url]) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const body = await res.json();
    delete body.cache; // per-request noise
    writeFileSync(`${DIR}/${file}`, `${JSON.stringify(body, null, 2)}\n`);
    console.log('wrote', file);
  })
);
