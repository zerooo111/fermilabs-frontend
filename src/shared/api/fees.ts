/**
 * Relayer fees module.
 *
 * Thin client for the relayer's `/fees/status` and `/fees-deposited` endpoints,
 * plus helpers to build the `memo + SystemProgram.transfer` instructions the
 * relayer expects for fee-credit deposits.
 *
 * The memo format (`fee_credit:v1:<user_owner>:<mango_account>`) and the
 * `instruction_index` contract with `/fees-deposited` must stay in sync with
 * the relayer — mirror of the reference SDK.
 */
import axios from 'axios';
import bs58 from 'bs58';
import {
  Connection,
  PublicKey,
  SendTransactionError,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { API_ROUTES, config } from '@/shared/config/constants';

/**
 * SPL Memo v2 program ID. The relayer scans for a memo instruction carrying
 * `fee_credit:v1:<user_owner>:<mango_account>` to attribute the deposit.
 */
export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export type FeeQuote = {
  market_index: number;
  quoted_fee_lamports: number;
  service_base_lamports: number;
  chain_cost_lamports: number;
  queue_pressure_multiplier_bps: number;
  bg_pressure_multiplier_bps: number;
  applied_multiplier_bps: number;
  queue_count: number;
  queue_soft_limit: number;
  queue_gap_span: number;
  queue_head_available: boolean;
  bg_submit_inflight: number;
  bg_submit_capacity: number;
  normal_max_fee_lamports: number;
  emergency_max_fee_lamports: number;
  relayer_prioritization_fee_micro_lamports: number;
  executor_prioritization_fee_micro_lamports: number;
  warning?: string | null;
};

export type FeeAccount = {
  mango_account: string;
  user_owner: string;
  created_at_ms: number;
  updated_at_ms: number;
  sponsored_seed_total_lamports: number;
  sponsored_seed_remaining_lamports: number;
  paid_credit_total_lamports: number;
  paid_credit_remaining_lamports: number;
  reserved_lamports: number;
  debited_lamports_total: number;
  available_balance_lamports: number;
  daily_quota_limit: number | null;
  daily_quota_used: number;
  daily_quota_window_start_ms: number;
  last_debit_at_ms: number | null;
  last_credit_at_ms: number | null;
  status: 'active' | 'frozen' | string;
};

export type FeeDepositContext = {
  deposit_address: string;
  memo: string;
  crediting_path: string;
  enforcement_mode: string;
};

export type FeeLedgerEntry = {
  id: string;
  mango_account: string;
  user_owner: string;
  entry_type: string;
  amount_lamports: number;
  balance_after_lamports: number;
  reference_type: string;
  reference_id: string;
  metadata_json: Record<string, unknown>;
  created_at_ms: number;
};

export type FeeStatus = {
  ok: boolean;
  user_owner: string;
  mango_account: string;
  enforcement_mode: string;
  fee_account: FeeAccount;
  quote: FeeQuote;
  deposit: FeeDepositContext;
  recent_entries: FeeLedgerEntry[];
};

export type FeeDepositReport = {
  source_chain: string;
  source_tx_signature: string;
  instruction_index: number;
  user_owner: string;
  mango_account: string;
  amount_lamports: number | string;
  deposit_address: string;
  memo: string;
  observed_at_ms?: number;
};

export type FeeDepositReportResponse = {
  ok: boolean;
  duplicate: boolean;
  deposit_credit_hash: string;
  fee_account: FeeAccount;
  recent_entries: FeeLedgerEntry[];
};

export type FeeStatusQuery = {
  userOwner: PublicKey | string;
  mangoAccount: PublicKey | string;
  market?: number;
  group?: PublicKey | string;
  executionQueue?: PublicKey | string;
};

function pubkeyStr(value: PublicKey | string): string {
  return typeof value === 'string' ? value : value.toBase58();
}

export function buildFeeDepositMemo(
  userOwner: PublicKey | string,
  mangoAccount: PublicKey | string
): string {
  return `fee_credit:v1:${pubkeyStr(userOwner)}:${pubkeyStr(mangoAccount)}`;
}

function memoInstruction(memo: string): TransactionInstruction {
  return new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, 'utf-8'),
  });
}

export type BuildFeeDepositInstructionsInput = {
  payer: PublicKey;
  userOwner: PublicKey | string;
  mangoAccount: PublicKey | string;
  depositAddress: PublicKey | string;
  lamports: number | bigint;
};

export type FeeDepositInstructions = {
  instructions: TransactionInstruction[];
  memo: string;
  /** Index of the SystemProgram.transfer ix inside `instructions` (always 1). */
  transferInstructionIndex: number;
};

export function buildFeeDepositInstructions(
  input: BuildFeeDepositInstructionsInput
): FeeDepositInstructions {
  const lamports = typeof input.lamports === 'bigint' ? Number(input.lamports) : input.lamports;
  if (!Number.isFinite(lamports) || lamports <= 0) {
    throw new Error(`fee deposit lamports must be a positive number (got ${lamports})`);
  }
  const depositAddress =
    typeof input.depositAddress === 'string'
      ? new PublicKey(input.depositAddress)
      : input.depositAddress;
  const memo = buildFeeDepositMemo(input.userOwner, input.mangoAccount);
  const instructions: TransactionInstruction[] = [
    memoInstruction(memo),
    SystemProgram.transfer({
      fromPubkey: input.payer,
      toPubkey: depositAddress,
      lamports,
    }),
  ];
  return { instructions, memo, transferInstructionIndex: 1 };
}

export class ContinuumFeeClient {
  constructor(private readonly baseUrl: string) {
    if (!baseUrl) {
      throw new Error('ContinuumFeeClient: baseUrl is required');
    }
  }

  private url(path: string): string {
    const trimmed = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    return `${trimmed}${path.startsWith('/') ? path : `/${path}`}`;
  }

  /** GET /fees/status — returns wallet fee balance, current quote, and deposit wiring. */
  async getStatus(query: FeeStatusQuery): Promise<FeeStatus> {
    const params: Record<string, string> = {
      user_owner: pubkeyStr(query.userOwner),
      mango_account: pubkeyStr(query.mangoAccount),
    };
    if (query.market !== undefined) params.market = String(query.market);
    if (query.group) params.group = pubkeyStr(query.group);
    if (query.executionQueue) params.execution_queue = pubkeyStr(query.executionQueue);
    const { data } = await axios.get<FeeStatus>(this.url(API_ROUTES.fees_status), { params });
    return data;
  }

  /**
   * POST /fees-deposited — tell the relayer about a completed deposit tx so it
   * credits the wallet's fee balance. Idempotent on `source_tx_signature`.
   */
  async reportDeposit(
    request: FeeDepositReport,
    adminToken?: string
  ): Promise<FeeDepositReportResponse> {
    const headers: Record<string, string> = {};
    if (adminToken) headers.Authorization = adminToken;
    const body = {
      ...request,
      amount_lamports:
        typeof request.amount_lamports === 'bigint'
          ? String(request.amount_lamports)
          : request.amount_lamports,
    };
    const { data } = await axios.post<FeeDepositReportResponse>(
      this.url(API_ROUTES.fees_deposited),
      body,
      { headers }
    );
    return data;
  }
}

/** Fee client wired to the gateway URL from `config.devnet`. */
export function createFeeClient(baseUrl: string = config.devnet.gatewayUrl): ContinuumFeeClient {
  return new ContinuumFeeClient(baseUrl);
}

/** Wallet-adapter-compatible signer — matches `useAnchorWallet()` shape. */
export type WalletSigner = {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
};

export type DepositFeeCreditWithWalletInput = {
  connection: Connection;
  wallet: WalletSigner;
  mangoAccount: PublicKey | string;
  lamports: number | bigint;
  depositAddress?: PublicKey | string;
  feeClient: ContinuumFeeClient;
  /** Defaults to `wallet.publicKey`. */
  userOwner?: PublicKey | string;
  sourceChain?: string;
  adminToken?: string;
};

/**
 * Browser variant of `depositFeeCredit` that signs through a wallet adapter.
 * Sends the tx, confirms it, then POSTs `/fees-deposited`.
 */
export async function depositFeeCreditWithWallet(
  input: DepositFeeCreditWithWalletInput
): Promise<FeeDepositReportResponse> {
  const userOwner = input.userOwner ?? input.wallet.publicKey;

  let depositAddress = input.depositAddress;
  if (!depositAddress) {
    const status = await input.feeClient.getStatus({
      userOwner,
      mangoAccount: input.mangoAccount,
    });
    depositAddress = status.deposit.deposit_address;
  }

  const { instructions, memo, transferInstructionIndex } = buildFeeDepositInstructions({
    payer: input.wallet.publicKey,
    userOwner,
    mangoAccount: input.mangoAccount,
    depositAddress,
    lamports: input.lamports,
  });

  const { blockhash, lastValidBlockHeight } =
    await input.connection.getLatestBlockhash('confirmed');
  const tx = new Transaction({
    feePayer: input.wallet.publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(...instructions);

  const signed = await input.wallet.signTransaction(tx);

  // Wallets (e.g. Phantom) may prepend a ComputeBudget instruction when signing,
  // shifting all indices by 1. Find the actual position of the SystemProgram.transfer
  // in the signed transaction so we report the correct instruction_index to the relayer.
  const systemProgramId = SystemProgram.programId.toBase58();
  const actualTransferIndex = signed.instructions.findIndex(
    ix => ix.programId.toBase58() === systemProgramId
  );
  const reportedTransferIndex =
    actualTransferIndex >= 0 ? actualTransferIndex : transferInstructionIndex;

  // skipPreflight avoids "Blockhash not found" during local simulation when the
  // RPC node hasn't yet propagated the blockhash we fetched. The network still
  // validates the transaction fully on submission.
  // maxRetries:0 prevents the RPC client from automatically re-sending an
  // already-confirmed transaction, which would surface as "already been processed".
  // The Solana tx signature is deterministic (first Ed25519 sig), so we can
  // derive it before sending and use it to proceed if the tx was already confirmed.
  const txSignatureBytes = signed.signatures[0]?.signature;
  const derivedSignature = txSignatureBytes ? bs58.encode(txSignatureBytes) : null;

  let signature: string;
  try {
    signature = await input.connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: true,
      preflightCommitment: 'confirmed',
      maxRetries: 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('already been processed') && derivedSignature) {
      // The tx landed on a prior attempt; treat it as confirmed and report the deposit.
      signature = derivedSignature;
    } else if (err instanceof SendTransactionError) {
      const logs = await err.getLogs(input.connection).catch(() => null);
      throw new Error(logs?.join('\n') ?? message);
    } else {
      throw err;
    }
  }

  await input.connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed'
  );

  const amountLamports =
    typeof input.lamports === 'bigint' ? Number(input.lamports) : input.lamports;
  return input.feeClient.reportDeposit(
    {
      source_chain: input.sourceChain ?? 'solana-devnet',
      source_tx_signature: signature,
      instruction_index: reportedTransferIndex,
      user_owner: pubkeyStr(userOwner),
      mango_account: pubkeyStr(input.mangoAccount),
      amount_lamports: amountLamports,
      deposit_address: pubkeyStr(depositAddress),
      memo,
      observed_at_ms: Date.now(),
    },
    input.adminToken
  );
}
