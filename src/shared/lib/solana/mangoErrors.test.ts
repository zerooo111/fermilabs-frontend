import { describe, expect, it } from 'vitest';

import { decodeMangoError, insufficientFundsMessage, parseProgramErrorCode } from './mangoErrors';

// DepositsIntoLiquidatingMustRecover, the error behind the Phantom
// "unsafe dApp" report: an account with negative health taking a deposit.
const LIQUIDATING = 6029;

describe('mangoErrors', () => {
  it('decodes 6029 from a simulation err object', async () => {
    const err = { InstructionError: [1, { Custom: LIQUIDATING }] };
    expect(parseProgramErrorCode(err)).toBe(LIQUIDATING);
    const decoded = await decodeMangoError(err);
    expect(decoded?.name).toBe('DepositsIntoLiquidatingMustRecover');
    expect(decoded?.message).toContain('initial margin requirement');
  });

  it('decodes 6029 from an Anchor log line', async () => {
    const logs = [
      'Program log: Instruction: TokenDeposit',
      'Program log: AnchorError occurred. Error Code: DepositsIntoLiquidatingMustRecover. Error Number: 6029. Error Message: token deposits into accounts that are being liquidated must bring their health above the init threshold.',
    ];
    const decoded = await decodeMangoError(
      { InstructionError: [1, 'ProgramFailedToComplete'] },
      logs
    );
    expect(decoded?.code).toBe(LIQUIDATING);
    expect(decoded?.message).toContain('being liquidated');
  });

  it('decodes 6029 from a hex custom program error', async () => {
    const err = new Error('failed to send transaction: custom program error: 0x178d');
    expect(parseProgramErrorCode(err)).toBe(LIQUIDATING);
    expect((await decodeMangoError(err))?.code).toBe(LIQUIDATING);
  });

  it('names the mid-liquidation error with its own wording', async () => {
    const decoded = await decodeMangoError({ InstructionError: [0, { Custom: 6016 }] });
    expect(decoded?.name).toBe('BeingLiquidated');
    expect(decoded?.message).toContain('Wait for the liquidation to finish');
  });

  it('falls back to the IDL message as a sentence', async () => {
    // 6028, TokenPositionDoesNotExist — no override of our own.
    const decoded = await decodeMangoError({ InstructionError: [0, { Custom: 6028 }] });
    expect(decoded?.message).toBe('Token position does not exist.');
  });

  it('returns null for transient failures and codes we do not know', async () => {
    expect(await decodeMangoError('BlockhashNotFound')).toBeNull();
    expect(await decodeMangoError(new Error('fetch failed'))).toBeNull();
    expect(await decodeMangoError({ InstructionError: [0, { Custom: 1 }] })).toBeNull();
    expect(await decodeMangoError(null)).toBeNull();
    expect(parseProgramErrorCode('AccountNotFound')).toBeNull();
  });

  it('reads a funding failure that carries no program error code', () => {
    expect(insufficientFundsMessage({ InsufficientFundsForRent: { account_index: 0 } })).toContain(
      'SOL'
    );
    expect(insufficientFundsMessage(null, ['Program log: Error: insufficient funds'])).toContain(
      'balance is too low'
    );
    expect(insufficientFundsMessage('BlockhashNotFound')).toBeNull();
  });
});
