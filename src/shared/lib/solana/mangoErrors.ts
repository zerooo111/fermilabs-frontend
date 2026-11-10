/**
 * Reading a Mango program error out of a failed simulation or send.
 *
 * A transaction that fails simulation inside the wallet shows up in Phantom as
 * "this dApp may be unsafe", with no hint of the actual program error. Decoding
 * the error ourselves lets a signing path stop before the popup and say what
 * went wrong — same reason as the SOL pre-check in ./gas.
 */

/** A program error we could put a name and a sentence to. */
export interface DecodedMangoError {
  code: number;
  /** The Rust variant, e.g. `DepositsIntoLiquidatingMustRecover`. */
  name: string;
  /** User-facing sentence. */
  message: string;
}

// Wording for the failures a depositor can actually act on. Everything else
// falls back to the IDL's own message.
const USER_MESSAGES: Record<number, string> = {
  6016:
    'Your margin account is being liquidated right now. Wait for the liquidation to finish, ' +
    'then deposit again.',
  6029:
    'Your margin account is being liquidated. A deposit only goes through if it brings your ' +
    'account health back above the initial margin requirement — deposit a larger amount.',
};

type IdlError = { code: number; name: string; msg?: string };

// The Mango IDL is ~1MB, so it stays out of the main bundle and is loaded the
// same way the deposit hook loads it: on demand, cached after the first call.
let errorsByCode: Map<number, IdlError> | null = null;

async function mangoErrors(): Promise<Map<number, IdlError>> {
  if (!errorsByCode) {
    const { IDL } = await import('@/shared/lib/mango-v4-idl');
    errorsByCode = new Map((IDL.errors as IdlError[]).map(e => [e.code, e]));
  }
  return errorsByCode;
}

/** Everything the error could be hiding in, as one searchable string. */
function haystack(err: unknown, logs?: string[] | null): string {
  const head =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : err == null
          ? ''
          : JSON.stringify(err);
  return [head, ...(logs ?? [])].join('\n');
}

/**
 * The program error code in a simulation error or its logs, in any of the
 * shapes Solana hands it to us: `{ InstructionError: [1, { Custom: 6029 }] }`,
 * an Anchor log line, or `custom program error: 0x178d`.
 */
export function parseProgramErrorCode(err: unknown, logs?: string[] | null): number | null {
  const text = haystack(err, logs);
  const json = text.match(/"Custom":\s*(\d+)/);
  if (json) return Number(json[1]);
  const anchor = text.match(/Error Number: (\d+)/);
  if (anchor) return Number(anchor[1]);
  const hex = text.match(/custom program error: 0x([0-9a-f]+)/i);
  if (hex) return parseInt(hex[1], 16);
  return null;
}

const sentence = (msg: string) => `${msg.charAt(0).toUpperCase()}${msg.slice(1)}.`;

/**
 * A named Mango error, or null when the failure isn't one we can attribute —
 * a stale blockhash, a lagging node, an error from some other program. The
 * caller must not block on null: a transient failure shouldn't stop a
 * transaction that would have worked.
 */
export async function decodeMangoError(
  err: unknown,
  logs?: string[] | null
): Promise<DecodedMangoError | null> {
  const code = parseProgramErrorCode(err, logs);
  if (code === null) return null;
  const known = (await mangoErrors()).get(code);
  if (!known) return null;
  const override = USER_MESSAGES[code];
  // Other program errors: the IDL message as a sentence, without the Rust name.
  const message = override ?? (known.msg ? sentence(known.msg) : known.name);
  return { code, name: known.name, message };
}

/**
 * A sentence for a failure that isn't a program error but still can't land: the
 * wallet or one of its token accounts can't pay for what the transaction does.
 */
export function insufficientFundsMessage(err: unknown, logs?: string[] | null): string | null {
  const text = haystack(err, logs).toLowerCase();
  if (text.includes('insufficientfundsforrent') || text.includes('insufficient lamports')) {
    return 'Your wallet does not have enough SOL to cover this transaction. Top up SOL and try again.';
  }
  if (text.includes('insufficient funds')) {
    return 'Your wallet balance is too low for this deposit. Lower the amount and try again.';
  }
  return null;
}
