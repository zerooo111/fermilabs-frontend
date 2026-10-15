/**
 * Vendored from @fermi-dex/flp-vault (github.com/Fermi-DEX/fermi-v1, flp-vault/sdk/src/index.ts)
 * at commit 2427a5418500d1da6359d3596a425fb158626060 (branch codex/flp-sdk-launch-unwind).
 * The package isn't published, so the source and IDL are copied here unchanged except for
 * the IDL import path. Its Rust ABI fixtures pass against this app's anchor 0.29 /
 * web3.js 1.98. The IDL's declared address is a placeholder: always pass the program ID.
 */
import { BN, BorshCoder, EventParser, Idl } from '@coral-xyz/anchor';
import { Buffer } from 'buffer';
import { AccountMeta, Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from '@solana/spl-token';
import schema from './flp_vault.json';

export { BN, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID };
export const FLP_IDL = schema as Idl;
export const NONE_EPOCH = new BN('18446744073709551615');
export const STATUS = { depositsPaused: 1, withdrawalsPaused: 2, breaker: 4, preDeposit: 8, unwind: 16, closed: 32 } as const;
export function vaultMode(status: number): 'pre-deposit' | 'live' | 'unwind' | 'closed' {
  if (status & STATUS.closed) return 'closed';
  if (status & STATUS.preDeposit) return 'pre-deposit';
  if (status & STATUS.unwind) return 'unwind';
  return 'live';
}

function unsigned(value: number | bigint | BN, bytes: number): Buffer {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('Use bigint or BN for large integers');
  const n = new BN(value.toString());
  if (n.isNeg() || n.bitLength() > bytes * 8) throw new Error(`Value does not fit u${bytes * 8}`);
  return n.toArrayLike(Buffer, 'le', bytes);
}

export function deriveVaultAddresses(programId: PublicKey, group: PublicKey, vaultId: number) {
  const derive = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, programId)[0];
  const vault = derive([Buffer.from('flp-vault'), group.toBuffer(), unsigned(vaultId, 2)]);
  return {
    vault,
    authority: derive([Buffer.from('flp-authority'), vault.toBuffer()]),
    shareMint: derive([Buffer.from('flp-shares'), vault.toBuffer()]),
    depositEscrow: derive([Buffer.from('flp-escrow'), vault.toBuffer(), Buffer.from('dep')]),
    redemptionEscrow: derive([Buffer.from('flp-escrow'), vault.toBuffer(), Buffer.from('red')]),
  };
}

export function deriveDepositor(programId: PublicKey, vault: PublicKey, user: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from('flp-user'), vault.toBuffer(), user.toBuffer()], programId)[0];
}
export function deriveEpoch(programId: PublicKey, vault: PublicKey, epoch: BN | bigint) {
  return PublicKey.findProgramAddressSync([Buffer.from('flp-epoch'), vault.toBuffer(), unsigned(epoch, 8)], programId)[0];
}
export function deriveFermiAccount(coreProgramId: PublicKey, group: PublicKey, authority: PublicKey, vaultId: number) {
  unsigned(vaultId, 2);
  return PublicKey.findProgramAddressSync([
    Buffer.from('FermiAccount'), group.toBuffer(), authority.toBuffer(), unsigned(vaultId, 4),
  ], coreProgramId)[0];
}

export interface Ticket { requestId: BN; epoch: BN; amount: BN; aux: BN }
export interface DepositorAccount {
  vault: PublicKey; user: PublicKey; bump: number; dep: Ticket; wd: Ticket;
  sharesHeld: BN; costBasis: BN; realizedPnl: BN; totalDeposited: BN; totalWithdrawn: BN;
  firstDepositTs: BN; lastActionTs: BN; reserved: number[];
}
export interface VaultAccount {
  version: number; status: number; vaultId: number; group: PublicKey; fermiAccount: PublicKey;
  quoteBank: PublicKey; quoteMint: PublicKey; shareMint: PublicKey;
  depositEscrow: PublicKey; redemptionEscrow: PublicKey; admin: PublicKey; delegate: PublicKey;
  epoch: BN; epochStartedAt: BN; owedUnmintedShares: BN; lockedShares: BN;
  deferredHead: BN; deferredTail: BN;
  preDepositTotal: BN; liveStartedAt: BN; terminalAssets: BN; terminalSupply: BN;
  recoveryParams: { graceProportionalS: number; graceFullS: number; oracleBandBps: number; maxStepQuote: BN };
  unwind: { mode: number; batchEpoch: BN; startedAt: BN; marketIndexes: number[]; targetBaseLots: BN[] };
  params: { epochDurationS: number; requestCutoffS: number; minDeposit: BN; minWithdrawShares: BN; [key: string]: unknown };
  [key: string]: unknown;
}
export interface EpochAccount {
  vault: PublicKey; epoch: BN; depNum: BN; depDen: BN; wdStatus: number;
  wdNum: BN; wdDen: BN; nextDeferred: BN; [key: string]: unknown;
}

/** Read/build only. The caller's wallet signs and sends transactions. */
export class FlpClient {
  readonly coder = new BorshCoder(FLP_IDL);
  readonly accountsCoder = this.coder.accounts;
  readonly instructionCoder = this.coder.instruction;
  readonly eventCoder = this.coder.events;
  constructor(readonly connection: Connection, readonly programId: PublicKey) {}
  parseEvents(logs: string[]) { return [...new EventParser(this.programId, this.coder).parseLogs(logs)]; }

  /** Nested account groups use dot paths, e.g. fermi.quoteBank. */
  instruction(name: string, accounts: Record<string, PublicKey>, args: Record<string, unknown> = {}, remaining: AccountMeta[] = []) {
    const definition = FLP_IDL.instructions.find(ix => ix.name === name);
    if (!definition) throw new Error(`Unknown FLP instruction: ${name}`);
    const keys: AccountMeta[] = [];
    const visit = (items: typeof definition.accounts, prefix = '') => {
      for (const item of items) {
        const path = prefix + item.name;
        if ('accounts' in item) visit(item.accounts, path + '.');
        else {
          const pubkey = accounts[path] ?? (item.isOptional ? this.programId : undefined);
          if (!pubkey) throw new Error(`Missing FLP account: ${path}`);
          keys.push({ pubkey, isWritable: item.isMut, isSigner: item.isSigner });
        }
      }
    };
    visit(definition.accounts);
    return new TransactionInstruction({ programId: this.programId, keys: [...keys, ...remaining], data: this.instructionCoder.encode(name, args) });
  }

  async fetch<T>(name: 'Vault' | 'Depositor' | 'EpochRecord', address: PublicKey): Promise<T> {
    const account = await this.connection.getAccountInfo(address, 'confirmed');
    if (!account || !account.owner.equals(this.programId)) throw new Error(`Missing or wrong-owner ${name}: ${address}`);
    return this.accountsCoder.decode<T>(name, account.data);
  }
  async fetchVault(address: PublicKey) {
    const state = await this.fetch<VaultAccount>('Vault', address);
    if (state.version !== 2) throw new Error(`Unsupported vault version: ${state.version}`);
    return state;
  }
  fetchDepositor(vault: PublicKey, user: PublicKey) { return this.fetch<DepositorAccount>('Depositor', deriveDepositor(this.programId, vault, user)); }
  fetchEpoch(vault: PublicKey, epoch: BN | bigint) { return this.fetch<EpochAccount>('EpochRecord', deriveEpoch(this.programId, vault, epoch)); }

  requestDeposit(vault: PublicKey, state: VaultAccount, user: PublicKey, amount: BN | bigint) {
    if (vaultMode(state.status) !== 'live') throw new Error('Use phase-aware deposit instructions');
    unsigned(amount, 8);
    return this.instruction('requestDeposit', {
      vault, depositor: deriveDepositor(this.programId, vault, user), user,
      userQuoteAccount: getAssociatedTokenAddressSync(state.quoteMint, user), depositEscrow: state.depositEscrow,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: new PublicKey('11111111111111111111111111111111'),
    }, { amount: new BN(amount.toString()) });
  }
  requestWithdraw(vault: PublicKey, state: VaultAccount, user: PublicKey, shares: BN | bigint) {
    unsigned(shares, 8);
    return this.instruction('requestWithdraw', {
      vault, depositor: deriveDepositor(this.programId, vault, user), user, shareMint: state.shareMint,
      userShareAccount: getAssociatedTokenAddressSync(state.shareMint, user, false, TOKEN_2022_PROGRAM_ID),
      token2022Program: TOKEN_2022_PROGRAM_ID,
    }, { shares: new BN(shares.toString()) });
  }
  private userAccounts(vault: PublicKey, state: VaultAccount, user: PublicKey) {
    const authority = PublicKey.findProgramAddressSync([Buffer.from('flp-authority'), vault.toBuffer()], this.programId)[0];
    return {
      vault, depositor: deriveDepositor(this.programId, vault, user), authority, user,
      userQuoteAccount: getAssociatedTokenAddressSync(state.quoteMint, user),
      userShareAccount: getAssociatedTokenAddressSync(state.shareMint, user, false, TOKEN_2022_PROGRAM_ID),
      shareMint: state.shareMint, depositEscrow: state.depositEscrow, redemptionEscrow: state.redemptionEscrow,
      tokenProgram: TOKEN_PROGRAM_ID, token2022Program: TOKEN_2022_PROGRAM_ID,
      systemProgram: new PublicKey('11111111111111111111111111111111'),
    };
  }
  cancelDeposit(vault: PublicKey, state: VaultAccount, user: PublicKey) {
    return this.instruction('cancelDeposit', this.userAccounts(vault, state, user));
  }
  cancelWithdraw(vault: PublicKey, state: VaultAccount, user: PublicKey) {
    return this.instruction('cancelWithdraw', this.userAccounts(vault, state, user));
  }
  claimDeposit(vault: PublicKey, state: VaultAccount, user: PublicKey, epoch: BN | bigint) {
    return this.instruction('claimDeposit', { ...this.userAccounts(vault, state, user), epochRecord: deriveEpoch(this.programId, vault, epoch) });
  }
  claimWithdrawal(vault: PublicKey, state: VaultAccount, user: PublicKey, epoch: BN | bigint) {
    return this.instruction('claimWithdrawal', { ...this.userAccounts(vault, state, user), epochRecord: deriveEpoch(this.programId, vault, epoch) });
  }
  preDeposit(vault: PublicKey, state: VaultAccount, user: PublicKey, amount: BN | bigint) {
    unsigned(amount, 8);
    return this.instruction('preDeposit', this.userAccounts(vault, state, user), { amount: new BN(amount.toString()) });
  }
  preWithdraw(vault: PublicKey, state: VaultAccount, user: PublicKey, amount: BN | bigint) {
    unsigned(amount, 8);
    return this.instruction('preWithdraw', this.userAccounts(vault, state, user), { amount: new BN(amount.toString()) });
  }
  terminalRedeem(vault: PublicKey, state: VaultAccount, user: PublicKey, shares: BN | bigint) {
    unsigned(shares, 8);
    return this.instruction('terminalRedeem', this.userAccounts(vault, state, user), { shares: new BN(shares.toString()) });
  }
  depositInstructions(vault: PublicKey, state: VaultAccount, user: PublicKey, amount: BN | bigint) {
    const mode = vaultMode(state.status);
    if (state.status & (STATUS.depositsPaused | STATUS.breaker) || mode === 'unwind' || mode === 'closed') throw new Error('Deposits are unavailable');
    return mode === 'pre-deposit' ? [this.shareAtaInstructions(state, user).instruction, this.preDeposit(vault, state, user, amount)]
      : [this.requestDeposit(vault, state, user, amount)];
  }
  withdrawalInstruction(vault: PublicKey, state: VaultAccount, user: PublicKey, shares: BN | bigint) {
    if (state.status & STATUS.withdrawalsPaused) throw new Error('Withdrawals are paused');
    const mode = vaultMode(state.status);
    return mode === 'pre-deposit' ? this.preWithdraw(vault, state, user, shares)
      : mode === 'closed' ? this.terminalRedeem(vault, state, user, shares)
      : this.requestWithdraw(vault, state, user, shares);
  }
  shareAtaInstructions(state: VaultAccount, user: PublicKey, payer = user) {
    const address = getAssociatedTokenAddressSync(state.shareMint, user, false, TOKEN_2022_PROGRAM_ID);
    return { address, instruction: createAssociatedTokenAccountIdempotentInstruction(payer, address, user, state.shareMint, TOKEN_2022_PROGRAM_ID) };
  }
}
