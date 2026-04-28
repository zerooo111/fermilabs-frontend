/**
 * Canonical SIWS-style message builder. **Must produce byte-identical output
 * to the Rust backend** — see `src/crypto.rs::build_redeem_message`. The
 * backend reconstructs this string from the challenge it issued and verifies
 * the signature against it; any drift in whitespace, line endings, or field
 * ordering breaks the gate.
 *
 * If you change this, change `build_redeem_message` in the proxy in the same
 * commit and add/update the snapshot test there.
 */
export function buildRedeemMessage(
  wallet: string,
  nonce: string,
  issued: string,
  expires: string
): string {
  return (
    `app.fermilabs.io wants you to sign in with your Solana account:\n` +
    `${wallet}\n\n` +
    `By signing, you grant this wallet trading access on Fermilabs.\n\n` +
    `URI: https://app.fermilabs.io\n` +
    `Chain: solana\n` +
    `Nonce: ${nonce}\n` +
    `Issued At: ${issued}\n` +
    `Expiration: ${expires}\n`
  );
}
