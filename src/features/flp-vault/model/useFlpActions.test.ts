import { BN } from '@coral-xyz/anchor';
import { Connection, Keypair, TransactionInstruction } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';

import { FlpV4Client, NONE_EPOCH, STATUS, type VaultAccount } from '../sdk';
import { FLP_PROGRAM_ID } from './config';
import { buildFlpAction, type FlpActionKind } from './useFlpActions';

// Real RC6 builders; the connection is never called by the actions tested here.
const client = new FlpV4Client(new Connection('http://127.0.0.1:1'), FLP_PROGRAM_ID);
const key = () => Keypair.generate().publicKey;

function ctx(status: number) {
  const state = {
    version: 4,
    status,
    quoteMint: key(),
    shareMint: key(),
    depositEscrow: key(),
    redemptionEscrow: key(),
    deferredHead: NONE_EPOCH,
  } as unknown as VaultAccount;
  return { vault: key(), state, owner: key(), client };
}

const names = (ixs: TransactionInstruction[]) =>
  ixs
    .filter(ix => ix.programId.equals(FLP_PROGRAM_ID))
    .map(ix => client.coder.instruction.decode(ix.data)?.name);

const build = (kind: FlpActionKind, status: number, amount = 1_000_000n) =>
  buildFlpAction(kind, amount, ctx(status), () => {}).then(r => names(r.ixs));

describe('buildFlpAction (RC6 version-4 builders)', () => {
  it('prepares the Depositor in the same transaction before every user instruction', async () => {
    expect(await build('deposit', 0)).toEqual(['initDepositor', 'requestDeposit']);
    expect(await build('cancel-withdraw', 0)).toEqual(['initDepositor', 'cancelWithdraw']);
    expect(await build('claim-graduated', 0)).toEqual(['initDepositor', 'claimPreDeposit']);
  });

  it('routes a deposit by phase: public principal before graduation, the queue after', async () => {
    expect(await build('deposit', STATUS.preDeposit)).toEqual(['initDepositor', 'preDepositV3']);
    expect(await build('deposit', 0)).toEqual(['initDepositor', 'requestDeposit']);
    await expect(build('deposit', STATUS.publicDepositsPaused)).rejects.toThrow(/unavailable/);
    await expect(build('deposit', STATUS.closed)).rejects.toThrow(/unavailable/);
  });

  it('withdraws trading shares through the queue, never the principal refund (guide B.2 rule 11)', async () => {
    expect(await build('withdraw', 0)).toEqual(['initDepositor', 'requestWithdraw']);
    expect(await build('withdraw', STATUS.preDeposit)).toEqual([
      'initDepositor',
      'requestWithdraw',
    ]);
    expect(await build('withdraw', STATUS.closed)).toEqual(['initDepositor', 'terminalRedeem']);
    await expect(build('withdraw', STATUS.withdrawalsPaused)).rejects.toThrow(/paused/);
  });

  it('refunds public principal only before graduation', async () => {
    expect(await build('refund', STATUS.preDeposit)).toEqual(['initDepositor', 'preWithdrawV3']);
    await expect(build('refund', 0)).rejects.toThrow(/graduated/);
  });

  it('refunds a pending deposit with the placeholder epoch slot', async () => {
    const { ixs } = await buildFlpAction('refund-pending-deposit', 0n, ctx(0), () => {});
    const refund = ixs[ixs.length - 1];
    // The optional epochRecord is the last fixed account: the program ID when absent.
    expect(refund.keys[refund.keys.length - 1].pubkey.equals(FLP_PROGRAM_ID)).toBe(true);
  });

  it('allows instant withdrawals only before graduation and with no deferred batch', async () => {
    await expect(build('instant-withdraw', 0)).rejects.toThrow(/before graduation/);
    const c = ctx(STATUS.preDeposit);
    c.state.deferredHead = new BN(4);
    await expect(buildFlpAction('instant-withdraw', 1n, c, () => {})).rejects.toThrow(
      /funded first/
    );
  });
});
