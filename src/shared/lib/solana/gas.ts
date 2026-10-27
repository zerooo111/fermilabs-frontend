/**
 * How much SOL a wallet needs before we ask it to sign anything.
 *
 * A wallet with no SOL can't pay the fee, so the transaction fails simulation
 * inside the wallet — and Phantom reports that as "this dApp may be unsafe"
 * rather than as a missing fee. Every signing path therefore reads the balance
 * first and throws `InsufficientSolError` instead of opening the popup, and the
 * forms show the same wording up front so the user never gets that far.
 */
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

/** Rent for the margin account a first deposit creates, plus its fees. */
export const SOL_FOR_NEW_ACCOUNT = 0.04;

/** Fee headroom only, for a wallet whose account already exists. */
export const SOL_FEE_BUFFER = 0.002;

export interface GasNeed {
  /** The transaction also creates the user's margin account (rent). */
  needsAccountCreation: boolean;
}

export function requiredSol({ needsAccountCreation }: GasNeed): number {
  return needsAccountCreation ? SOL_FOR_NEW_ACCOUNT : SOL_FEE_BUFFER;
}

export function requiredLamports(need: GasNeed): number {
  return Math.ceil(requiredSol(need) * LAMPORTS_PER_SOL);
}

export const solFromLamports = (lamports: number | bigint): number =>
  Number(lamports) / LAMPORTS_PER_SOL;

/** Up to four places, without trailing zeros: 0.04, 0.002, 0. */
export const formatSol = (sol: number): string => sol.toFixed(4).replace(/\.?0+$/, '');

export function hasEnoughSol(balanceLamports: number | bigint, need: GasNeed): boolean {
  return Number(balanceLamports) >= requiredLamports(need);
}

/** The nudge and the thrown error say the same thing, with the same numbers. */
export function insufficientSolText(need: GasNeed & { balanceSol: number }): string {
  const have = `You have ${formatSol(need.balanceSol)} SOL.`;
  return need.needsAccountCreation
    ? `You need about ${formatSol(requiredSol(need))} SOL in your wallet to create your margin account and cover network fees. ${have}`
    : `You need about ${formatSol(requiredSol(need))} SOL in your wallet for network fees. ${have}`;
}

/** Thrown before the wallet is ever asked to sign; the message is user-facing. */
export class InsufficientSolError extends Error {
  name = 'InsufficientSolError';
  readonly requiredSol: number;
  readonly balanceSol: number;

  constructor(need: GasNeed & { balanceSol: number }) {
    super(insufficientSolText(need));
    this.requiredSol = requiredSol(need);
    this.balanceSol = need.balanceSol;
  }
}

/** Stops a signing path that the wallet can't pay for. */
export function assertEnoughSol(balanceLamports: number | bigint, need: GasNeed): void {
  if (hasEnoughSol(balanceLamports, need)) return;
  throw new InsufficientSolError({ ...need, balanceSol: solFromLamports(balanceLamports) });
}
