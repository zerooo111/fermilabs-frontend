# flp-vault

Fermi's protocol liquidity vault (FLP): read its state, build the user's
transactions, and the FLP-only UI shown on the vault page under `/vaults`
(`features/vaults` owns the pages; this feature owns FLP data and actions).

Protocol docs (source of truth, kept current by the protocol team):
fermi-v1 `flp-vault/docs/` — `INTEGRATION_GUIDE.md` (RC6 deployment, the
version-4 methods, disclosures), `frontend-guide.md` (user flows),
`data-endpoints.md` (data API fields), `sdk-guide.md`. Rules cited in code as
"B.2 rule N" are from the earlier frontend guide and still hold.

## Deployment: RC6.1 (mainnet)

One version-4 vault, `8aHdjx…pbP`, on program `FLPRrD…oa9Q` (the same ID as
devnet; the RPC picks the cluster), trading on its own Fermi r9 group
(core `FRMiX9…dd4`, group `2mDvxS…hRse`), not the main dashboard's. Quote is
real USDC (`EPjFWd…Dt1v`). Addresses come from the SDK's `RC6_MAINNET_RELEASE`.

- Data comes from the FLP-only mainnet reader
  (`https://flp-mainnet.34-116-238-207.sslip.io`), separate from the main
  dashboard's harness, through the gateway's pass-through
  (`<gateway>/v2/flp/mainnet/state/...`, same paths and responses; gateway
  `docs/vaults.md`). The browser never calls the reader host. A response must carry profile `rc6` for this program
  and vault (`parseEnvelope(body, vault)`); the devnet reader's `rc6-devnet`
  copy of the same program is rejected. A 422 shows the vault as unavailable.
- Pre-launch (status 72, `PRE_DEPOSIT` + `PUBLIC_DEPOSITS_PAUSED`): only
  approved wallets can deposit (direct deposit, FLP at once); public
  pre-deposits fail with 6003 until intake opens, so the form says so and
  `ui/LaunchStrip.tsx` explains it. Approval is an admin action; there's no
  whitelist service and no faucet. Both come from the lifecycle and
  `user.availability`, never hard-coded.
- Epochs last 24 h, with the request cutoff 1 h before each close.

## Data flow

```
data API (harness) ──► api.ts ──► schema.ts (runtime check) ──► react-query
   /state/vaults/:vault[/users/:owner]                            │
                                                                  ├─► view.ts (derived values, routes, availability)
                                                                  │      └─► ui/* (form, requests, holdings, performance)
                                                                  └─► features/vaults/model/flpSource.ts ──► Vault (list + detail pages)
chain (RPC) ──► chain.ts: wallet balances, confirmations
SDK (vendored, FlpV4Client) ──► useFlpActions.ts / pricing.ts: build, sign, send, confirm
```

- Display data comes from the data API, one request per vault (and wallet).
  The chain is read only to build transactions and for wallet balances.
- The API serves stale copies while it refreshes (`cache.stale`); a fresh read
  takes 15–40 s on devnet. Reads older than the user's last confirmed
  transaction are `syncing` (txStore `minSlot`) and polled fast; buttons wait.
- `useFlpLiveUpdates` (once per vault page) subscribes to the vault, the
  Depositor and the wallet's token accounts.
- Transaction state (phase, last result, pending) lives in `txStore` and the
  `flpKeys.tx(vault)` mutation key, not in components: closing the dialog
  mid-send loses nothing, and only one transaction per vault runs at a time.

## Wallet

The app's Privy wallet (wallet-adapter `useWallet()`), on the app's mainnet
RPC (`config.devnet.rpcUrl`, despite the name). The vault pages need no other
provider.

## Invariants

- Amounts are `bigint` native units end to end. `features/vaults/model/flpSource.ts`
  is the only place they become display `number`s; never feed those back.
- An unknown value (`{ value: null, reason }`, a null NAV) stays `null` and
  renders as a dash. Never as 0 (B.2 rule 9).
- `fetchVault` runs before every transaction (the program rejects
  instructions built for a phase that changed). The v4 `fetchVault` also
  authenticates the recovery sidecar.
- Every user instruction comes from a `FlpV4Client` `…Instructions` method:
  it returns the whole array (the idempotent `initDepositor` first, then the
  destination token accounts it needs), sent as one transaction. The v4
  builders don't check the phase; `buildFlpAction` does, so a stale page fails
  before the wallet prompt.
- Share withdrawals are `requestWithdrawInstructions` (or
  `terminalRedeemInstructions` once closed), never `preWithdrawInstructions`:
  that's the public-principal refund (B.2 rule 11). `useFlpActions.test.ts`
  guards it against the real builders.
- Direct deposits and instant withdrawals are simulated first; `minShares` /
  `minQuote` come from the simulated event less `TOLERANCE_BPS`.
- Priced instructions take health accounts in FermiAccount perp-slot order,
  then one event queue per active slot (`pricing.ts`; 6043 otherwise).
- Every deposit view shows the standing unsettled-profit disclosure, also
  when the amount is unknown (`view.upnlRisk`). Its operator notice tiers
  (`operator-notice`, `page-operator`) request settlement; they aren't a breaker.
- No health percentage: RC6 has no numerical Init-health breaker, and core
  health is checked by the actual core withdrawal.
- A funding window shows as open only on authenticated current evidence from
  a fresh read (`view.vaultView().funding`); a stale copy claims nothing.
- Share price tooltips give NAV_mid, NAV_high (instant entry) and NAV_low
  (instant exit) with the slot of the vault's last on-chain valuation.
- A read for one wallet never stands in for another (`envelope.owner` check).

## Config and the vendored SDK

- Addresses: `model/config.ts`, from `RC6_MAINNET_RELEASE` (the deployed
  artifact). `RC6_RELEASE` is the canonical baseline with a placeholder
  vault ID: don't use it for addresses. No env overrides.
- `sdk/src` and `sdk/idl` are byte-for-byte copies of fermi-v1
  `flp-vault/sdk` (`sdk/VENDOR.json`); eslint and prettier skip them. Never edit.
  `sdk/index.ts` re-exports the legacy entry (types, PDAs, status bits) and the
  v4 entry. `sdk/fermi_core_accounts.json` is a trimmed core IDL
  (FermiAccount, Bank, PerpMarket), loaded only for priced instructions.
- `pnpm flp:sync` reports drift between config/SDK and the guide's mainnet
  table, `docs/mainnet-rc6.1.json` (and the reader's `/deployment.json` copy)
  and the markets' base decimals;
  `pnpm flp:sync --write` re-vendors the SDK from fermi-v1 `main`, checking
  the v4 IDL against the guide's canonical hash.

## Verifying changes

- `pnpm test` — pure logic against real API responses in `model/__fixtures__`
  (`pnpm flp:fixtures` re-captures the mainnet ones): mainnet pre-launch,
  RC6 devnet live, and RC4 for an approved wallet with principal and shares.
  `fixtures.ts` has `rc6()` to relabel one as the mainnet reader's and
  `edit()` for states the vaults aren't in (paused, unwind, null NAV, …).
- `pnpm typecheck` (baseline-aware, see `scripts/typecheck.mjs`), `pnpm lint`.
- No wallet locally (no `VITE_PRIVY_APP_ID`): open
  `http://localhost:8070/vaults/mainnet/<vault>?flpOwner=<wallet>` to see that
  wallet's balance, requests and form limits read-only (dev builds only).
  `C72X2LJ8DbBYawwMcWr7qF9emiRQdbCTZGEpAhjGZQqx` is the approved funding wallet.
