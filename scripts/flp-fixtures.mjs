#!/usr/bin/env node
// Capture FLP data API responses as test fixtures (src/features/flp-vault/model/__fixtures__).
// Re-run when the API's shape changes:  node scripts/flp-fixtures.mjs
// Fresh reads can take 40 s; the files are written as they arrive.
import { writeFileSync } from 'node:fs';

const API = process.env.FLP_API_URL ?? 'https://flp.34-116-238-207.sslip.io';
const DIR = 'src/features/flp-vault/model/__fixtures__';
const PRE = '8fAqhdnBWnCN2nkkkX4qhU316bhhsvAtKRfoCAv1Hmgo'; // vault 3, pre-deposit
const LIVE = 'FXFEzgjZyFYcNvhAuCVhFw33qShzP659WG5wvZHXrPnL'; // vault 1, live
// A devnet test wallet with shares in both vaults and an approved direct-deposit account on vault 3.
const WALLET = process.env.FLP_FIXTURE_WALLET ?? 'APEs3GeG4oWmqT919AA9df8YZv1VHun2BXpnW4YPFx7s';
// A wallet with no Depositor record (user: null).
const NOBODY = 'Fermi111111111111111111111111111111111111111';

const shots = {
  'pre-deposit.json': `/state/vaults/${PRE}`,
  'pre-deposit-user.json': `/state/vaults/${PRE}/users/${WALLET}`,
  'pre-deposit-nouser.json': `/state/vaults/${PRE}/users/${NOBODY}`,
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
