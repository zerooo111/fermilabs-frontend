import { Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';

import type { FlpClient, VaultAccount } from '../sdk';
import { buildFlpAction } from './useFlpActions';

const ix = new TransactionInstruction({
  keys: [],
  programId: PublicKey.default,
  data: Buffer.alloc(0),
});

function ctx() {
  const client = {
    depositInstructions: vi.fn(() => [ix]),
    publicRefundInstruction: vi.fn(() => ix),
    tradingWithdrawalInstruction: vi.fn(() => ix),
    withdrawalInstruction: vi.fn(() => ix),
    shareAtaInstructions: vi.fn(() => ({ address: PublicKey.default, instruction: ix })),
    cancelDeposit: vi.fn(() => ix),
    cancelWithdraw: vi.fn(() => ix),
  };
  const state = {
    quoteMint: Keypair.generate().publicKey,
    shareMint: Keypair.generate().publicKey,
  } as unknown as VaultAccount;
  return {
    client,
    ctx: {
      vault: Keypair.generate().publicKey,
      state,
      owner: Keypair.generate().publicKey,
      client: client as unknown as FlpClient,
    },
  };
}

describe('buildFlpAction', () => {
  it('withdraws trading shares through the queue, never the escrow refund (guide B.2 rule 11)', async () => {
    const { client, ctx: c } = ctx();
    const { ixs } = await buildFlpAction('withdraw', 1_000_000n, c, () => {});
    expect(client.tradingWithdrawalInstruction).toHaveBeenCalledWith(
      c.vault,
      c.state,
      c.owner,
      1_000_000n
    );
    expect(client.withdrawalInstruction).not.toHaveBeenCalled();
    // Creates the USDC account a payout lands in, then the request.
    expect(ixs).toHaveLength(2);
  });

  it('refunds public principal with the refund builder', async () => {
    const { client, ctx: c } = ctx();
    await buildFlpAction('refund', 2_000_000n, c, () => {});
    expect(client.publicRefundInstruction).toHaveBeenCalledWith(
      c.vault,
      c.state,
      c.owner,
      2_000_000n
    );
  });

  it('creates the share account before a deposit and before a withdrawal cancel', async () => {
    const { client, ctx: c } = ctx();
    const deposit = await buildFlpAction('deposit', 5_000_000n, c, () => {});
    expect(client.shareAtaInstructions).toHaveBeenCalled();
    expect(deposit.ixs).toHaveLength(2);
    await buildFlpAction('cancel-withdraw', 0n, c, () => {});
    expect(client.shareAtaInstructions).toHaveBeenCalledTimes(2);
  });
});
