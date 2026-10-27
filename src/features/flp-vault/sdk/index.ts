// Vendored @fermi-dex/flp-vault: src/ and idl/ are byte-for-byte copies of
// fermi-v1 flp-vault/sdk (see VENDOR.json). Never edit them; run `pnpm flp:sync`.
// RC6 vaults are version 4: build every instruction with FlpV4Client
// (src/v4.ts). The legacy entry is here for the shared types, PDA helpers and
// status bits only; its builders encode earlier vault versions.
export * from './src';
export {
  FlpV4Client,
  FLP_V4_IDL,
  RC6_RELEASE,
  RC6_MAINNET_RELEASE,
  V4_FUNDING_FAILURE,
  batchPayout,
  deriveFundingWindow,
  fundingWindowIsCurrent,
  fundingWindowIsOpen,
  permissionlessTriggerAt as permissionlessTriggerAtV4,
  type FundingWindowAccount,
  type V4Accounts,
} from './src/v4';
