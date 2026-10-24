# vaults

The public vault pages: `/vaults` (list) and `/vaults/:network/:address`
(detail, with the Deposit / Withdraw dialog). Both routes sit behind the
`showUnlaunched` host gate (`shared/lib/domains.ts`): staging and localhost
only, until vaults launch.

## Sources

A page draws `Vault` rows (`api/vaultsClient.ts`) from two sources, merged in
`model/useVaults.ts`:

- **FLP vaults** — `model/flpSource.ts` adapts the FLP data API
  (`features/flp-vault`) into `Vault`. These are the vaults users can
  deposit into. Their detail page adds FLP panels (devnet strip, requests,
  performance, holdings) from `features/flp-vault`.
- **Gateway vaults** — the gateway's vault sync (`/v2/vaults`), only called
  when `VITE_VAULTS_GATEWAY_URL` is set. It isn't deployed anywhere yet; when
  it lists an FLP vault, the FLP read wins.

`Vault` numbers are display `number`s. A field that can be unknown is
`number | null` and the formatters in `model/format.ts` render null as a dash.
`user` is `undefined` while the wallet's read is loading, `null` when the
wallet holds nothing.

Other vault code in the repo: `features/vault-deposit` and `/vault` are the
older `fermi_vault` program, unrelated to FLP.
