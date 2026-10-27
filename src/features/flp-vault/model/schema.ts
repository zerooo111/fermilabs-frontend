/**
 * Runtime check of the data API response, for the fields this app reads. The
 * protocol team changes the API often; a renamed or retyped field should fail
 * loudly here, not render as a wrong number. Unknown extra fields pass.
 * The TypeScript shapes are in api.ts; fixtures in __fixtures__ keep the two
 * honest (schema.test.ts).
 */
import { z } from 'zod';

import type { FlpEnvelope } from './api';
import { FLP_API_PROFILE, FLP_PROGRAM_ID } from './config';

const native = z.string().regex(/^-?\d+$/, 'decimal integer string');
const fixed = z.object({ raw: native, fractionalBits: z.number() });
const unknownValue = z.object({ value: z.null(), reason: z.string() }).passthrough();

const ticket = z
  .object({
    state: z.enum([
      'none',
      'queued',
      'claimable-shares',
      'refund-only',
      'funded-claimable',
      'deferred',
      'unavailable',
    ]),
    ticket: z.object({ requestId: native, epoch: native, amount: native, aux: native }),
    claimable: native,
    cancellable: z.boolean(),
  })
  .passthrough();

const user = z
  .object({
    owner: z.string(),
    depositApproved: z.boolean(),
    sharesHeld: native,
    investedSharesIncludingOwedAndUnfunded: native,
    refundablePublicPrincipal: native,
    graduationClaimableShares: native,
    deposit: ticket,
    withdrawal: ticket,
    availability: z
      .object({
        depositsBlockedByStatus: z.boolean(),
        publicDepositsBlockedByStatus: z.boolean(),
        withdrawalsBlockedByStatus: z.boolean(),
      })
      .passthrough(),
    pnl: z
      .object({
        recordedRealizedQuote: native,
        heldSharesCostBasisQuote: native,
        totalDepositedRecorded: native,
        totalWithdrawnRecorded: native,
        currentUnrealized: z.union([
          z.object({ value: native, indicativeInvestedValueQuote: native }).passthrough(),
          unknownValue,
        ]),
      })
      .passthrough(),
  })
  .passthrough();

const portfolio = z
  .object({
    positions: z.array(
      z
        .object({
          marketIndex: z.number(),
          name: z.string(),
          baseLotSize: native,
          quoteLotSize: native,
          baseLots: native,
          bidsBaseLots: native,
          asksBaseLots: native,
          signedExposureSettlementNative: fixed,
          unsettledPnlSettlementNative: fixed,
          unsettledFundingNative: fixed,
          oraclePriceSettlementNativePerBaseNative: fixed,
        })
        .passthrough()
    ),
    collateral: z.array(z.object({ tokenIndex: z.number(), decimals: z.number() }).passthrough()),
    valuation: z.object({ unsettledPerpQuoteNative: fixed }).passthrough(),
  })
  .passthrough();

const fundingWindow = z
  .object({
    closedEpoch: native,
    scheduledStart: native,
    deadline: native,
    eligible: z.boolean(),
    authenticated: z.boolean(),
    current: z.boolean(),
    open: z.boolean(),
  })
  .passthrough();

const upnlRisk = z
  .object({
    depositDisclosure: z.string(),
    grossPositiveUnsettledPnlQuoteNative: z.union([fixed, unknownValue]),
    upnlToNavRatio: z.union([fixed, unknownValue]),
    monitor: z
      .object({
        tier1: z.object({ status: z.string() }).passthrough(),
        tier2: z.object({ status: z.string(), triggers: z.array(z.string()) }).passthrough(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const envelopeSchema = z
  .object({
    schema_version: z.literal(1),
    generated_ts_ms: z.number(),
    source: z.object({ slot: native, program_id: z.string(), profile: z.string() }).passthrough(),
    vault: z.string(),
    owner: z.string().nullable(),
    data: z
      .object({
        units: z.object({ quoteDecimals: z.number(), shareDecimals: z.number() }).passthrough(),
        lifecycle: z
          .object({
            mode: z.enum(['pre-deposit', 'live', 'unwind', 'closed']),
            depositsPaused: z.boolean(),
            publicDepositsPaused: z.boolean(),
            withdrawalsPaused: z.boolean(),
            breaker: z.boolean(),
          })
          .passthrough(),
        configuration: z
          .object({
            params: z
              .object({
                epochDurationS: z.number(),
                requestCutoffS: z.number(),
                tvlCap: native,
                minDeposit: native,
                minWithdrawShares: native,
              })
              .passthrough(),
          })
          .passthrough(),
        epoch: z
          .object({ current: native, scheduledEnd: native, requestTarget: native })
          .passthrough(),
        shares: z.object({ pricingSupply: native }).passthrough(),
        valuation: z
          .object({
            currentNav: z.object({ value: fixed.nullable() }).passthrough(),
            lastProgramNav: z.object({ navMid: native, slot: native }).passthrough(),
            segregated: z.object({ depositEscrowBalance: native }).passthrough(),
          })
          .passthrough(),
        flows: z.object({ netDeposits: native, activeDepositors: z.number() }).passthrough(),
        fundingWindow: fundingWindow.nullable().optional(),
        standingUpnlRisk: upnlRisk.optional(),
        portfolio: z.union([portfolio, unknownValue, z.null()]),
        user: user.nullable(),
      })
      .passthrough(),
  })
  .passthrough();

/**
 * Parse a data API body, naming the first field that doesn't match. With
 * `vault`, the response must also be the RC6 reader's view of that vault on
 * this deployment's program (frontend_flow.cjs `harnessVault`): a reader still
 * on an older profile must not stand in for it.
 */
export function parseEnvelope(body: unknown, vault?: string): FlpEnvelope {
  const result = envelopeSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`FLP data API changed: ${issue.path.join('.') || 'body'}: ${issue.message}`);
  }
  const env = body as FlpEnvelope;
  if (vault !== undefined) {
    if (env.source.profile !== FLP_API_PROFILE)
      throw new Error(
        `FLP data API serves the ${env.source.profile} profile, not ${FLP_API_PROFILE}`
      );
    if (env.source.program_id !== FLP_PROGRAM_ID.toBase58() || env.vault !== vault)
      throw new Error('FLP data API answered for another program or vault');
  }
  return env;
}
