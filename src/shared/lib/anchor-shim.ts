// Re-export shim for @coral-xyz/anchor.
//
// Anchor's published ESM index uses CommonJS-style runtime exports for `Wallet`
// (`if (!isBrowser) exports.Wallet = ...`), which Rollup cannot statically resolve.
// `@blockworks-foundation/mango-v4` imports `Wallet` from the bare specifier, so we
// alias `@coral-xyz/anchor` to this shim in vite.config.js to make the symbol
// statically available to the bundler.
//
// The exported `Wallet` here is the Node-style keypair wallet — it is only consumed
// internally by MangoClient for IDL/group reads (see mango-client.ts: ReadOnlyWallet).
// All user-facing signing in this app goes through the browser wallet adapter
// (`useWallet()` / `signMessage`), see signIntentMessage in usePerps.ts.

export * from '@coral-xyz/anchor/dist/esm/index.js';
export { default as Wallet } from '@coral-xyz/anchor/dist/esm/nodewallet.js';
