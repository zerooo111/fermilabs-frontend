# flp-vault

Fermi's protocol liquidity vault (FLP): read its state, build the user's
transactions, and the FLP-only UI shown on the vault page under `/vaults`
(`features/vaults` owns the pages; this feature owns FLP data and actions).

Protocol docs (source of truth, kept current by the protocol team):
fermi-v1 `flp-vault/docs/` — `INTEGRATION_GUIDE.md` (RC6 deployment, the
version-4 methods, disclosures), `frontend-guide.md` (user flows),
`data-endpoints.md` (data API fields), `sdk-guide.md`. Rules cited in code as
"B.2 rule N" are from the earlier frontend guide and still hold.

## Deployment: RC6 (devnet)

One version-4 vault, `DSF7hK…rUhu`, on program `FLPRrD…oa9Q` (core
`6zuHzx…uX5`), on a private test group with synthetic test USDC (`BPmUCs…`).
The RC4 vaults (program `5EJSS…`) are not RC6 accounts.

- The data API must serve the `rc6-devnet` profile for this program and vault
  (`parseEnvelope(body, vault)` checks `source.profile`, `source.program_id`,
  `vault`). A 422 (a reader that can't read the vault) shows the vault as
  unavailable.
- The host's faucet mints RC6 test USDC (max 10,000 per request, 50,000 per
  wallet per day). Its RC4 whitelist service is retired, so there's no
  approval button (`faucet` / `whitelist` in `config.ts`).
- Epochs last 10 minutes; the team's keeper closes each one shortly after
  `epoch.scheduledEnd`.

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

> **TODO (remove before mainnet):** the separate devnet wallet below is a
> temporary testing workaround. When FLP moves to mainnet, delete
> `ui/DevnetWallet.tsx` and the `FlpWalletProvider` wrappers in
> `pages/vaults` and `pages/vault-detail`, so the vault pages use the app's
> Privy wallet like everything else.

The vault pages wrap their content in `FlpWalletProvider` (`ui/DevnetWallet.tsx`):
a direct wallet-standard connection (Phantom, Solflare, Backpack…) on the devnet
RPC, with its own saved selection. Privy, which handles the app's mainnet
trading login, isn't used on these pages. Inside them `useWallet()` is the devnet
wallet; transactions are signed sign-only, so the wallet's own network setting
applies (testers switch their wallet to devnet / testnet mode).

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

- Addresses: `model/config.ts`, from the INTEGRATION_GUIDE.md devnet table
  and the runtime artifact receipt (`mainnet/rc6/devnet/`). Don't check them
  against `RC6_RELEASE`: its program IDs are the production pins.
  Env: `VITE_FLP_RPC_URL`, `VITE_FLP_API_URL` (both optional, devnet defaults).
- `sdk/src` and `sdk/idl` are byte-for-byte copies of fermi-v1
  `flp-vault/sdk` (`sdk/VENDOR.json`); eslint and prettier skip them. Never edit.
  `sdk/index.ts` re-exports the legacy entry (types, PDAs, status bits) and the
  v4 entry. `sdk/fermi_core_accounts.json` is a trimmed core IDL
  (FermiAccount, Bank, PerpMarket), loaded only for priced instructions.
- `pnpm flp:sync` reports drift between config/SDK and those records (and the
  data API's `/deployment.json` once it describes RC6);
  `pnpm flp:sync --write` re-vendors the SDK from fermi-v1 `main`, checking
  the v4 IDL against the guide's canonical hash.

## Verifying changes

- `pnpm test` — pure logic against real API responses in `model/__fixtures__`
  (`pnpm flp:fixtures` re-captures them). They're RC4 captures until the RC6
  reader is hosted; `fixtures.ts` has `rc6()` to relabel one and `edit()` for
  states the devnet vaults aren't in (paused, unwind, null NAV, …).
- `pnpm typecheck` (baseline-aware, see `scripts/typecheck.mjs`), `pnpm lint`.
- No wallet locally (no `VITE_PRIVY_APP_ID`): open
  `http://localhost:8070/vaults/devnet/<vault>?flpOwner=<wallet>` to see that
  wallet's balance, requests and form limits read-only (dev builds only).
  On RC6, `CSYxXfixXywMcTGECWjiJdoD75gtzU67fA8JR6YqFvha` holds shares and
  direct-deposit approval.
- Devnet funds: the vault page's devnet strip calls the host's faucet (and
  whitelist, for vaults that have one).
