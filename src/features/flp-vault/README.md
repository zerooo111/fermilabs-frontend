# flp-vault

Fermi's protocol liquidity vault (FLP): read its state, build the user's
transactions, and the FLP-only UI shown on the vault page under `/vaults`
(`features/vaults` owns the pages; this feature owns FLP data and actions).

Protocol docs (source of truth, kept current by the protocol team):
fermi-v1 `flp-vault/docs/` — `INTEGRATION_GUIDE.md` (deployment, endpoints,
devnet helpers), `frontend-guide.md` (user flows; Part B rules are cited in
code as "B.2 rule N"), `data-endpoints.md` (data API fields), `sdk-guide.md`.

## Data flow

```
data API (harness) ──► api.ts ──► schema.ts (runtime check) ──► react-query
   /state/vaults/:vault[/users/:owner]                            │
                                                                  ├─► view.ts (derived values, routes, availability)
                                                                  │      └─► ui/* (form, requests, holdings, performance)
                                                                  └─► features/vaults/model/flpSource.ts ──► Vault (list + detail pages)
chain (RPC) ──► chain.ts: wallet balances, confirmations
SDK (vendored) ──► useFlpActions.ts / pricing.ts: build, sign, send, confirm
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
  instructions built for a phase that changed).
- Share withdrawals use `tradingWithdrawalInstruction`, never
  `withdrawalInstruction` (before graduation that's the escrow refund, B.2
  rule 11). `useFlpActions.test.ts` guards it.
- Direct deposits and instant withdrawals are simulated first; `minShares` /
  `minQuote` come from the simulated event less `TOLERANCE_BPS`.
- Priced instructions take health accounts in FermiAccount perp-slot order,
  then one event queue per active slot (`pricing.ts`; 6043 otherwise).
- Every deposit view shows the standing unsettled-profit disclosure
  (`view.upnlRisk`, required by the deployment manifest).
- A read for one wallet never stands in for another (`envelope.owner` check).

## Config and the vendored SDK

- Addresses: `model/config.ts`, from `${FLP_API_URL}/deployment.json`.
  Env: `VITE_FLP_RPC_URL`, `VITE_FLP_API_URL` (both optional, devnet defaults).
- `sdk/src` and `sdk/idl` are byte-for-byte copies of fermi-v1
  `flp-vault/sdk` (`sdk/VENDOR.json`); eslint and prettier skip them. Never edit.
  `sdk/fermi_core_accounts.json` is a trimmed core IDL (FermiAccount, Bank,
  PerpMarket), loaded only for priced instructions.
- `pnpm flp:sync` reports drift between config/SDK and the manifest;
  `pnpm flp:sync --write` re-vendors the SDK from fermi-v1 `main`.

## Verifying changes

- `pnpm test` — pure logic against real API responses in `model/__fixtures__`
  (`pnpm flp:fixtures` re-captures them). `fixtures.ts` has an `edit()` helper
  for states the devnet vaults aren't in (paused, unwind, null NAV, …).
- `pnpm typecheck` (baseline-aware, see `scripts/typecheck.mjs`), `pnpm lint`.
- No wallet locally (no `VITE_PRIVY_APP_ID`): open
  `http://localhost:8070/vaults/devnet/<vault>?flpOwner=<wallet>` to see that
  wallet's balance, requests and form limits read-only (dev builds only).
  `APEs3GeG4oWmqT919AA9df8YZv1VHun2BXpnW4YPFx7s` holds shares in both vaults.
- Devnet funds: the vault page's devnet strip calls the faucet and whitelist
  services (INTEGRATION_GUIDE.md section 6).
