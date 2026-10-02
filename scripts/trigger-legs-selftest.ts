/**
 * Golden-vector check for src/features/trigger-orders/lib/triggerLegs.ts.
 * The relayer, keeper and fermi-v1 TS sketch pin the same values; a port
 * that reproduces them is byte-compatible with both.
 *
 *   pnpm test:trigger-legs
 */
import { ed25519 } from '@noble/curves/ed25519';
import { PublicKey } from '@solana/web3.js';
import { buildExecutionQueueUserIntentV5, QueueSide } from '@/shared/lib/mango-execution-queue';
import {
  buildTriggerLeg,
  triggerCancelHash,
  triggerDirection,
  TriggerDirection,
  TriggerKind,
  triggerLimitPriceLots,
} from '@/features/trigger-orders/lib/triggerLegs';

const GROUP = '2mDvxS4A6bJyR3RjLwvBWeNuFvCAaQ26ss7w1jUChRse';
const ACCOUNT = '9nNhSkcxYFujiydpuuhVttUYBqYJQmxCzjrBofBvmutF';
const QUEUE = 'VugpJNgQNdQmVonc24S2HLQrvfXYVkknxnPd4yssw4M';
const MARKET = '95gqXmc8E6Pb9BTYGpQY157DzdP7MBvnaG7Fpj5FAH2y';

function check(label: string, actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`${label}: got ${String(actual)}, want ${String(expected)}`);
  }
}

const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

async function main() {
  // ed25519 seed of 32 x 0x07, as in the Rust tests.
  const signer = new PublicKey(ed25519.getPublicKey(new Uint8Array(32).fill(7))).toBase58();
  check('signer', signer, 'GmaDrppBC7P5ARKV8g3djiwP89vz1jLK23V2GBjuAEGB');

  const leg = await buildTriggerLeg({
    group: GROUP,
    mangoAccount: ACCOUNT,
    marketIndex: 2,
    side: QueueSide.Ask,
    kind: TriggerKind.StopLoss,
    triggerPriceLots: 95_000n,
    size: 'all',
    slippageBps: 0,
    ocoGroup: 0x1122334455667788n,
    expiryTs: 1_790_000_000n,
    salt: 0x0a0b0c0d0e0f1011n,
    // The golden payload pins the IOC limit at 94_500.
    limitPriceLots: 94_500n,
  });
  check('commitment', leg.clientOrderId, 13565989750763315032n);
  check('direction', leg.terms.direction, TriggerDirection.AtOrBelow);

  const { digest } = await buildExecutionQueueUserIntentV5({
    group: GROUP,
    executionQueue: QUEUE,
    mangoAccount: ACCOUNT,
    userOwner: signer,
    payload: leg.payload,
    remainingAccounts: [
      { pubkey: GROUP, is_signer: false, is_writable: false },
      { pubkey: ACCOUNT, is_signer: false, is_writable: true },
      { pubkey: signer, is_signer: false, is_writable: false },
      { pubkey: MARKET, is_signer: false, is_writable: true },
    ],
    targetKind: 0,
    targetIndex: 2,
    clientOrderId: leg.clientOrderId,
    minExecuteSlot: 0n,
    expiresAtSlot: 0n,
  });
  check(
    'intent hash',
    hex(digest),
    'fd7c48676e05786dd1e25ec4e2ae382f632b1393186186f5af013fc1a4cccf66'
  );

  // Side / direction / limit table (client-SL-TP.md).
  check('long SL', triggerDirection(QueueSide.Ask, TriggerKind.StopLoss), 1);
  check('long TP', triggerDirection(QueueSide.Ask, TriggerKind.TakeProfit), 0);
  check('short SL', triggerDirection(QueueSide.Bid, TriggerKind.StopLoss), 0);
  check('short TP', triggerDirection(QueueSide.Bid, TriggerKind.TakeProfit), 1);
  check('ask limit rounds down', triggerLimitPriceLots(QueueSide.Ask, 95_001n, 50), 94_525n);
  check('bid limit rounds up', triggerLimitPriceLots(QueueSide.Bid, 95_001n, 50), 95_477n);

  // Cancel hash is 32 bytes and scope-sensitive.
  const base = {
    group: GROUP,
    mangoAccount: ACCOUNT,
    signer,
    issuedAtMs: 1_790_000_000_000n,
  };
  const byGroup = await triggerCancelHash({ ...base, scope: 'oco_group', ocoGroup: 1n });
  const byAll = await triggerCancelHash({ ...base, scope: 'all' });
  check('cancel hash length', byGroup.length, 32);
  check('cancel scopes differ', hex(byGroup) !== hex(byAll), true);

  console.log('trigger legs: golden vector OK');
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
