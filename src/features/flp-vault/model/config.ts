/**
 * FLP vault deployment. FLP lives on its own devnet deployment, separate from
 * the cluster the rest of the app trades on, so it gets its own RPC.
 */
import { PublicKey } from '@solana/web3.js';

export const FLP_CLUSTER = 'devnet';
export const FLP_RPC_URL: string =
  import.meta.env.VITE_FLP_RPC_URL || 'https://api.devnet.solana.com';
export const FLP_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_FLP_PROGRAM_ID || 'FRgcDUy3WweXNUDmB8MrQSRNmievsnTiTH7i3VFCxwYp'
);
// Vault id 3 on test group 414: the fresh pre-deposit vault `new-vault` made
// after the smoke test closed ids 1 and 2.
export const FLP_VAULT = new PublicKey(
  import.meta.env.VITE_FLP_VAULT || 'H8YmVdWWH2dZ6wyGFtZUwZrzeMVfd8gFNAXqHxScMiyq'
);

export function flpExplorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${FLP_CLUSTER}`;
}
