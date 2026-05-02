import { showOrderToast } from '@/features/order-placement/lib/showOrderToast';
import { toast } from 'sonner';
import axios from 'axios';
import posthog from 'posthog-js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { useCallback, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { useSelectedMarket } from '@/entities/market';
import { serverConfigAtom } from '@/entities/server';
import { config, API_ROUTES, API_ROUTES_V2 } from '@/shared/config/constants';
import {
  buildExecutionQueueUserIntentV5,
  bytesToBase64,
  deriveExecutionQueueV5Pda,
  encodePerpCancelOrderQueuePayload,
  encodePerpPlaceOrderV2QueuePayload,
  IntentTargetKind,
  QueueAccountMeta,
  QueuePlaceOrderType,
  QueueSelfTradeBehavior,
  QueueSide,
  randomU64,
  uiBaseToLots,
  uiPriceToLots,
  uiQuoteToLots,
} from '@/shared/lib/mango-execution-queue';
import { getMangoClientAndGroup } from '@/shared/lib/mango-client';
import { buildCanonicalPerpRemainingAccounts } from '@/shared/lib/mango-canonical-accounts';
import { useAccountMangoAccount } from '@/shared/hooks/useAccount';
import { getWalletAuthToken } from '@/features/access-gate';
import type { HarnessMarketMetadata } from '@/shared/lib/harness-market';
import type { MarginMode, OrderSide } from '@/features/order-placement/lib/PerpLimitOrderIntent';

type OrderType = 'limit' | 'market';

interface PerpsSubmitOrderParams {
  side: OrderSide;
  price: string;
  size: string;
  leverage: string;
  marginMode: MarginMode;
  stopLoss?: string;
  takeProfit?: string;
  orderType?: OrderType;
  maxSlippageBps?: number;
}

interface PerpsMarketOrderParams {
  side: OrderSide;
  size: string;
  leverage: string;
  marginMode: MarginMode;
  maxSlippageBps: number;
  markPrice: number;
}

interface PerpsClosePositionParams {
  side: OrderSide;
  size: string;
  mode: 'market' | 'limit';
  markPrice: number;
  maxSlippageBps?: number;
  limitPrice?: string;
}

type ExecutionMarketParams = {
  base_decimals: number;
  quote_decimals: number;
  base_lot_size: number;
  quote_lot_size: number;
};

type HarnessFullMarketsResponse = {
  market_metadata?: Record<string, HarnessMarketMetadata>;
};

const MANGO_STATE_TTL_MS = 30 * 1000;
const MARKET_META_CACHE_TTL_MS = 60 * 60 * 1000;
const RELAY_DUPLICATE_SEQUENCE_RETRIES = 2;
const RELAY_INTENT_VERSION = 2;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function isDuplicateSequenceRelayError(detail: string): boolean {
  const normalized = detail.toLowerCase();
  return (
    normalized.includes('duplicate sequence') || normalized.includes('relayer cursor reconciled')
  );
}

function formatRelaySubmitError(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : 'Unknown relay submit error';
  }

  const data = error.response?.data as
    | {
        error?: string;
        required_lamports?: string | number;
        available_lamports?: string | number;
        deposit_address?: string;
      }
    | undefined;
  const detail = data?.error || error.response?.statusText || error.message;

  if (detail === 'please deposit gas') {
    const requiredLamports = data?.required_lamports;
    const availableLamports = data?.available_lamports;
    const depositAddress = data?.deposit_address;
    const parts = ['Relay fee balance is empty. Top up SOL for relayer fees and retry.'];
    if (requiredLamports !== undefined) {
      parts.push(`Required: ${requiredLamports} lamports.`);
    }
    if (availableLamports !== undefined) {
      parts.push(`Available: ${availableLamports} lamports.`);
    }
    if (depositAddress) {
      parts.push(`Deposit address: ${depositAddress}.`);
    }
    return parts.join(' ');
  }

  if (detail === 'base fee too low') {
    return 'Relay base fee too low. Retry with AUTO fee selection or increase the fee cap.';
  }

  // Opaque upstream gRPC failures (e.g. "1 CANCELLED: Call cancelled") give no clue
  // on their own. Dump the full HTTP response so the cause is visible in DevTools.
  if (/^\d+\s+\w+/.test(detail)) {
    console.error('[relay submit] upstream gRPC error', {
      status: error.response?.status,
      data: error.response?.data,
      headers: error.response?.headers,
    });
  }

  return detail;
}

function sideToQueueSide(side: OrderSide): QueueSide {
  return side === 'Buy' ? QueueSide.Bid : QueueSide.Ask;
}

export function usePerps() {
  const { publicKey, signMessage, wallet } = useWallet();
  const { connection } = useConnection();
  const { selectedMarket } = useSelectedMarket();
  const serverConfig = useAtomValue(serverConfigAtom);
  const owner = publicKey?.toBase58() || '';
  const { pk: mangoAccountPk } = useAccountMangoAccount(owner || undefined);
  const selectedMarketId = selectedMarket?.uuid || config.devnet.defaultHarnessMarketId;
  const hasSelectedMarket = Boolean(selectedMarket);
  const fallbackBaseDecimals = Number(selectedMarket?.base_decimals ?? config.devnet.baseDecimals);
  const fallbackQuoteDecimals = Number(
    selectedMarket?.quote_decimals ?? config.devnet.quoteDecimals
  );
  const fallbackBaseLotSize = Number(selectedMarket?.base_lot_size ?? config.devnet.baseLotSize);
  const fallbackQuoteLotSize = Number(selectedMarket?.quote_lot_size ?? config.devnet.quoteLotSize);
  const canonicalAccountsCacheRef = useRef<{
    owner: string;
    mangoAccount: string;
    marketIndex: number;
    group: string;
    remainingAccounts: QueueAccountMeta[];
    fetchedAtMs: number;
  } | null>(null);
  const marketMetaCacheRef = useRef<{
    market: string;
    value: ExecutionMarketParams;
    fetchedAtMs: number;
  } | null>(null);
  const marketMetaRequestRef = useRef<{
    market: string;
    promise: Promise<ExecutionMarketParams>;
  } | null>(null);

  const logPerf = useCallback((label: string, data: Record<string, number | string>) => {
    if (import.meta.env.DEV) {
      console.info(`[perps-timing] ${label}`, data);
    }
  }, []);

  const normalizeWalletSignature = (value: unknown): Uint8Array | null => {
    if (value instanceof Uint8Array) return value;
    if (value && typeof value === 'object' && 'signature' in value) {
      const sig = (value as { signature?: unknown }).signature;
      if (sig instanceof Uint8Array) return sig;
    }
    return null;
  };

  const isUserRejectedSignatureError = (error: unknown): boolean => {
    const code = (error as { code?: unknown })?.code;
    if (code === 4001 || code === '4001' || code === 'ACTION_REJECTED') {
      return true;
    }

    const message = error instanceof Error ? error.message : String(error ?? '');
    const normalized = message.toLowerCase();
    return (
      normalized.includes('user rejected') ||
      normalized.includes('user denied') ||
      normalized.includes('request rejected') ||
      normalized.includes('request denied') ||
      normalized.includes('transaction rejected') ||
      normalized.includes('signature rejected') ||
      normalized.includes('signature denied') ||
      normalized.includes('cancelled') ||
      normalized.includes('canceled') ||
      normalized.includes('declined')
    );
  };

  // Sign the v5 intent digest. Phantom (and several other wallets) refuse to
  // sign 32-byte binary blobs via signMessage — their tx-detection heuristic
  // rejects them with "You cannot sign solana transactions using sign message".
  // Workaround: sign the lowercase-hex ASCII form of the digest (64 bytes of
  // valid UTF-8). The relayer's verify_user_signature falls back to verifying
  // against canonical_user_intent_message_hex_utf8 (main.rs:13360-13366), so a
  // signature over the hex form is accepted as if it were over the raw digest.
  const signIntentMessage = async (message: Uint8Array): Promise<Uint8Array> => {
    if (!publicKey || !signMessage) {
      throw new Error('Wallet not connected');
    }

    const startedAt = performance.now();
    const adapterAny = wallet?.adapter as any;
    const maybeWindow = globalThis as any;
    const intentHex = Buffer.from(message).toString('hex');
    const intentBase58 = bs58.encode(message);
    const intentHexUtf8Bytes = new TextEncoder().encode(intentHex);
    const providerCandidates = [adapterAny?._wallet].filter(Boolean) as any[];

    const attemptedErrors: string[] = [];
    const trySign = async (
      label: string,
      fn: () => Promise<unknown>
    ): Promise<Uint8Array | null> => {
      try {
        const result = await fn();
        const signature = normalizeWalletSignature(result);
        if (signature) return signature;
      } catch (error) {
        if (isUserRejectedSignatureError(error)) {
          throw new Error('Signature request rejected');
        }
        attemptedErrors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      }
      return null;
    };

    // Primary path: ask the wallet adapter to sign the 64-byte hex-ASCII form.
    // Works on Phantom/Solflare/Backpack via the standard signMessage interface
    // and bypasses the "looks like a transaction" heuristic that rejects raw
    // 32-byte binary digests.
    const adapterHexUtf8 = await trySign('walletAdapter.signMessage(hexUtf8)', () =>
      signMessage(intentHexUtf8Bytes)
    );
    if (adapterHexUtf8) {
      logPerf('wallet-sign', {
        strategy: 'wallet-adapter(hexUtf8)',
        sign_ms: Math.round(performance.now() - startedAt),
      });
      return adapterHexUtf8;
    }

    // Try direct provider access first so the wallet-adapter's signMessage — which emits
    // an error event caught by WalletProvider even when we handle the error ourselves —
    // is only used as a last resort.
    for (const provider of providerCandidates) {
      if (provider?.signMessage) {
        // Raw-bytes strategies first — these are what the relayer verifies against.
        // The 'hex' / {display:'hex'} argument only controls the wallet popup display,
        // it does NOT alter which bytes get signed; the relayer always verifies the
        // Ed25519 signature against the raw 32-byte userIntentMessage hash.
        const sigHex = await trySign('provider.signMessage(hex)', () =>
          provider.signMessage(message, 'hex')
        );
        if (sigHex) {
          logPerf('wallet-sign', {
            strategy: 'provider.signMessage(hex)',
            sign_ms: Math.round(performance.now() - startedAt),
          });
          return sigHex;
        }

        const sigHexObj = await trySign('provider.signMessage({display:hex})', () =>
          provider.signMessage(message, { display: 'hex' })
        );
        if (sigHexObj) {
          logPerf('wallet-sign', {
            strategy: 'provider.signMessage({display:hex})',
            sign_ms: Math.round(performance.now() - startedAt),
          });
          return sigHexObj;
        }

        const sigDefault = await trySign('provider.signMessage(default)', () =>
          provider.signMessage(message)
        );
        if (sigDefault) {
          logPerf('wallet-sign', {
            strategy: 'provider.signMessage(default)',
            sign_ms: Math.round(performance.now() - startedAt),
          });
          return sigDefault;
        }

        // Legacy fallbacks: older Phantom builds that interpreted 'hex' as an encoding
        // hint and decoded the input before signing. Modern Phantom signs raw bytes
        // regardless, so these would produce a signature over the wrong message; kept
        // here only so ancient wallets that cannot sign raw bytes still get a chance.
        const sigHexUtf8 = await trySign('provider.signMessage(hexUtf8Bytes,hex)', () =>
          provider.signMessage(intentHexUtf8Bytes, 'hex')
        );
        if (sigHexUtf8) {
          logPerf('wallet-sign', {
            strategy: 'provider.signMessage(hexUtf8Bytes,hex)',
            sign_ms: Math.round(performance.now() - startedAt),
          });
          return sigHexUtf8;
        }

        const sigHexString = await trySign('provider.signMessage(hexString,hex)', () =>
          provider.signMessage(intentHex, 'hex')
        );
        if (sigHexString) {
          logPerf('wallet-sign', {
            strategy: 'provider.signMessage(hexString,hex)',
            sign_ms: Math.round(performance.now() - startedAt),
          });
          return sigHexString;
        }

        const sigBase58String = await trySign('provider.signMessage(base58String,hex)', () =>
          provider.signMessage(intentBase58, 'hex')
        );
        if (sigBase58String) {
          logPerf('wallet-sign', {
            strategy: 'provider.signMessage(base58String,hex)',
            sign_ms: Math.round(performance.now() - startedAt),
          });
          return sigBase58String;
        }

        const sigHexObjString = await trySign(
          'provider.signMessage({message:hexString,display:hex})',
          () => provider.signMessage({ message: intentHex, display: 'hex' })
        );
        if (sigHexObjString) {
          logPerf('wallet-sign', {
            strategy: 'provider.signMessage({message:hexString,display:hex})',
            sign_ms: Math.round(performance.now() - startedAt),
          });
          return sigHexObjString;
        }
      }

      if (provider?.request) {
        const req1 = await trySign('provider.request(signMessage, object bytes)', () =>
          provider.request({
            method: 'signMessage',
            params: { message, display: 'hex' },
          })
        );
        if (req1) {
          logPerf('wallet-sign', {
            strategy: 'provider.request(object)',
            sign_ms: Math.round(performance.now() - startedAt),
          });
          return req1;
        }

        const req2 = await trySign('provider.request(signMessage, object array)', () =>
          provider.request({
            method: 'signMessage',
            params: { message: Array.from(message), display: 'hex' },
          })
        );
        if (req2) {
          logPerf('wallet-sign', {
            strategy: 'provider.request(object-array)',
            sign_ms: Math.round(performance.now() - startedAt),
          });
          return req2;
        }

        const req3 = await trySign('provider.request(signMessage, tuple)', () =>
          provider.request({
            method: 'signMessage',
            params: [message, 'hex'],
          })
        );
        if (req3) {
          logPerf('wallet-sign', {
            strategy: 'provider.request(tuple)',
            sign_ms: Math.round(performance.now() - startedAt),
          });
          return req3;
        }

        const reqHexUtf8 = await trySign('provider.request(signMessage, object hexUtf8Bytes)', () =>
          provider.request({
            method: 'signMessage',
            params: { message: intentHexUtf8Bytes, display: 'hex' },
          })
        );
        if (reqHexUtf8) {
          logPerf('wallet-sign', {
            strategy: 'provider.request(object-hexUtf8Bytes)',
            sign_ms: Math.round(performance.now() - startedAt),
          });
          return reqHexUtf8;
        }

        const reqHexString = await trySign('provider.request(signMessage, object hexString)', () =>
          provider.request({
            method: 'signMessage',
            params: { message: intentHex, display: 'hex' },
          })
        );
        if (reqHexString) {
          logPerf('wallet-sign', {
            strategy: 'provider.request(object-hexString)',
            sign_ms: Math.round(performance.now() - startedAt),
          });
          return reqHexString;
        }

        const reqBase58String = await trySign(
          'provider.request(signMessage, object base58String)',
          () =>
            provider.request({
              method: 'signMessage',
              params: { message: intentBase58, display: 'hex' },
            })
        );
        if (reqBase58String) {
          logPerf('wallet-sign', {
            strategy: 'provider.request(object-base58String)',
            sign_ms: Math.round(performance.now() - startedAt),
          });
          return reqBase58String;
        }

        const reqTupleHexString = await trySign(
          'provider.request(signMessage, tuple hexString)',
          () =>
            provider.request({
              method: 'signMessage',
              params: [intentHex, 'hex'],
            })
        );
        if (reqTupleHexString) {
          logPerf('wallet-sign', {
            strategy: 'provider.request(tuple-hexString)',
            sign_ms: Math.round(performance.now() - startedAt),
          });
          return reqTupleHexString;
        }
      }
    }

    // Final fallback: wallet-adapter's signMessage (may emit an error event to WalletProvider
    // if the wallet doesn't support it, but at this point all direct paths have been exhausted).
    const adapterSig = await trySign('walletAdapter.signMessage', () => signMessage(message));
    if (adapterSig) {
      logPerf('wallet-sign', {
        strategy: 'wallet-adapter',
        sign_ms: Math.round(performance.now() - startedAt),
      });
      return adapterSig;
    }

    const adapterName = wallet?.adapter?.name || 'unknown';
    throw new Error(
      `Failed to sign canonical intent message (${message.length} bytes) via ${adapterName}. ${attemptedErrors.join(' | ') || 'No signer returned a signature'}`
    );
  };

  const resolveCanonicalAccountsForMarket = useCallback(
    async (
      marketIndex: number
    ): Promise<{
      group: string;
      mangoAccount: string;
      remainingAccounts: QueueAccountMeta[];
    }> => {
      if (!publicKey) throw new Error('Wallet not connected');
      if (!mangoAccountPk) throw new Error('Mango account missing; deposit margin first');

      const cached = canonicalAccountsCacheRef.current;
      if (
        cached &&
        cached.owner === owner &&
        cached.mangoAccount === mangoAccountPk &&
        cached.marketIndex === marketIndex &&
        Date.now() - cached.fetchedAtMs < MANGO_STATE_TTL_MS
      ) {
        return {
          group: cached.group,
          mangoAccount: cached.mangoAccount,
          remainingAccounts: cached.remainingAccounts,
        };
      }

      const startedAt = performance.now();
      const { client, group } = await getMangoClientAndGroup(connection, serverConfig);
      const mangoAccount = await client.getMangoAccount(new PublicKey(mangoAccountPk));
      const remainingAccounts = await buildCanonicalPerpRemainingAccounts({
        client,
        group,
        mangoAccount,
        userOwner: publicKey,
        marketIndex,
      });
      logPerf('canonical-accounts', {
        market: marketIndex,
        resolve_ms: Math.round(performance.now() - startedAt),
        account_count: remainingAccounts.length,
      });

      const result = {
        group: group.publicKey.toBase58(),
        mangoAccount: mangoAccountPk,
        remainingAccounts,
      };
      canonicalAccountsCacheRef.current = {
        owner,
        mangoAccount: mangoAccountPk,
        marketIndex,
        ...result,
        fetchedAtMs: Date.now(),
      };
      return result;
    },
    [connection, logPerf, mangoAccountPk, owner, publicKey, serverConfig]
  );

  const resolveExecutionMarketParams = useCallback(async (): Promise<ExecutionMarketParams> => {
    if (!hasSelectedMarket) {
      throw new Error('Selected market not found');
    }

    const marketId = selectedMarketId;
    const cached = marketMetaCacheRef.current;
    if (
      cached &&
      cached.market === marketId &&
      Date.now() - cached.fetchedAtMs < MARKET_META_CACHE_TTL_MS
    ) {
      return cached.value;
    }

    const inFlight = marketMetaRequestRef.current;
    if (inFlight && inFlight.market === marketId) {
      return inFlight.promise;
    }

    const request = (async (): Promise<ExecutionMarketParams> => {
      try {
        // v2 path: /v2/markets returns {markets: [{market, meta: {base_decimals, ...}}]}
        // Every field we need is in the meta hash. Falls back to /state/full
        // only when useV2ReadLayer is off.
        if (config.devnet.useV2ReadLayer) {
          const response = await axios.get<{
            markets: Array<{ market: string; meta: Record<string, string> }>;
          }>(`${config.devnet.gatewayUrl}${API_ROUTES_V2.markets}`);
          const row = response.data?.markets?.find(m => m.market === marketId);
          const meta = row?.meta;
          if (meta) {
            const resolved = {
              base_decimals: Number(meta.base_decimals),
              quote_decimals: Number(meta.quote_decimals),
              base_lot_size: Number(meta.base_lot_size),
              quote_lot_size: Number(meta.quote_lot_size),
            };
            marketMetaCacheRef.current = {
              market: marketId,
              value: resolved,
              fetchedAtMs: Date.now(),
            };
            return resolved;
          }
        } else {
          const response = await axios.get<HarnessFullMarketsResponse>(
            `${config.devnet.gatewayUrl}${API_ROUTES.markets}?view=optimistic`
          );
          const marketMeta = response.data?.market_metadata?.[marketId];
          if (marketMeta) {
            const resolved = {
              base_decimals: Number(marketMeta.base_decimals),
              quote_decimals: Number(marketMeta.quote_decimals),
              base_lot_size: Number(marketMeta.base_lot_size),
              quote_lot_size: Number(marketMeta.quote_lot_size),
            };
            marketMetaCacheRef.current = {
              market: marketId,
              value: resolved,
              fetchedAtMs: Date.now(),
            };
            return resolved;
          }
        }
      } catch {
        // Fall back to the selected market snapshot if the harness metadata request fails.
      }

      return {
        base_decimals: fallbackBaseDecimals,
        quote_decimals: fallbackQuoteDecimals,
        base_lot_size: fallbackBaseLotSize,
        quote_lot_size: fallbackQuoteLotSize,
      };
    })();
    marketMetaRequestRef.current = {
      market: marketId,
      promise: request,
    };
    try {
      return await request;
    } finally {
      if (marketMetaRequestRef.current?.promise === request) {
        marketMetaRequestRef.current = null;
      }
    }
  }, [
    fallbackBaseDecimals,
    fallbackBaseLotSize,
    fallbackQuoteDecimals,
    fallbackQuoteLotSize,
    hasSelectedMarket,
    selectedMarketId,
  ]);

  const submitIntent = async (params: {
    payloadBytes: Uint8Array;
    remainingAccounts: QueueAccountMeta[];
    group: string;
    market: string;
    mangoAccount: string;
  }): Promise<{
    success: boolean;
    txSignature?: string;
    acceptedLatencyMs?: number;
    error?: string;
  }> => {
    if (!publicKey || !signMessage) {
      throw new Error('Wallet not connected');
    }
    const targetIndex = Number(params.market);
    if (!Number.isInteger(targetIndex) || targetIndex < 0) {
      throw new Error(`Invalid market index for relay intent: ${params.market}`);
    }

    // execution_queue is NOT part of the v5 digest (relayer derives it from
    // program/group/target_index), but the HTTP bridge still requires the field
    // to be a non-empty string. Use the address from /config when available, else
    // derive locally as a fallback.
    const configMarket = serverConfig?.markets.find(m => m.market_index === targetIndex);
    const v5ExecutionQueue =
      configMarket?.execution_queue.address ??
      (config.devnet.mangoProgramId
        ? deriveExecutionQueueV5Pda(
            config.devnet.mangoProgramId,
            params.group,
            targetIndex
          ).toBase58()
        : '');
    if (!v5ExecutionQueue) {
      throw new Error('execution_queue not available; server config not loaded');
    }

    const intentClientOrderId = randomU64();
    const startedAt = performance.now();
    // V5 digest construction. The accountsHash inside this builder applies the
    // CTM-enqueue effective-flag merge: it OR-merges is_signer/is_writable for
    // [group, executionQueue, SYSVAR_INSTRUCTIONS] into the corresponding
    // remaining_accounts entries before hashing — exactly what the relayer and
    // on-chain program do. Skipping the merge produces a digest the relayer
    // rejects (typical symptom: remaining_accounts[0] is `group` with wire
    // is_writable=false, but the relayer sees it as writable=true after merge).
    const intent = await buildExecutionQueueUserIntentV5({
      group: params.group,
      executionQueue: v5ExecutionQueue,
      mangoAccount: params.mangoAccount,
      userOwner: publicKey.toBase58(),
      payload: params.payloadBytes,
      remainingAccounts: params.remainingAccounts,
      targetKind: IntentTargetKind.PerpMarket,
      targetIndex,
      clientOrderId: intentClientOrderId,
      minExecuteSlot: 0n,
      expiresAtSlot: 0n,
    });
    const toHex = (b: Uint8Array) =>
      Array.from(b)
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');

    console.info('[submit-intent debug]', {
      domain: 'mango-v5-user-intent-v2',
      group: params.group,
      executionQueue: v5ExecutionQueue,
      mangoAccount: params.mangoAccount,
      userOwner: publicKey.toBase58(),
      kind: 0,
      targetKind: IntentTargetKind.PerpMarket,
      targetIndex,
      clientOrderId: intentClientOrderId.toString(),
      minExecuteSlot: '0',
      expiresAtSlot: '0',
      payloadLen: params.payloadBytes.length,
      payloadHex: toHex(params.payloadBytes),
      payloadHash: toHex(intent.payloadHash),
      accountsCount: params.remainingAccounts.length,
      remainingAccounts: params.remainingAccounts,
      accountsHash: toHex(intent.accountsHash),
      digest: toHex(intent.digest),
    });
    const builtIntentAt = performance.now();
    // Phantom/Solflare/Backpack signMessage() always signs the raw bytes — no
    // prefix wrapping. The relayer verifies the 64-byte ed25519 signature against
    // the raw 32-byte digest, so passing `intent.digest` directly is correct.
    const signatureBytes = await signIntentMessage(intent.digest);

    console.info('[submit-intent signature]', {
      digestSigned: toHex(intent.digest),
      signatureHex: toHex(signatureBytes),
      signatureLen: signatureBytes.length,
    });
    // Client-side verification: ed25519.verify(sig, digest, ownerPubkey).
    // If this fails, the relayer will also reject. Surface the mismatch with
    // diagnostics so we can distinguish "wallet wraps the message somehow"
    // from "wallet signs with a different key than user_owner".
    try {
      const { ed25519 } = await import('@noble/curves/ed25519');
      const ownerBytes = publicKey.toBytes();
      const okRaw = ed25519.verify(signatureBytes, intent.digest, ownerBytes);
      const digestHexUtf8 = new TextEncoder().encode(toHex(intent.digest));
      const okHexUtf8 = ed25519.verify(signatureBytes, digestHexUtf8, ownerBytes);

      console.info('[submit-intent client-verify]', {
        connectedPubkey: publicKey.toBase58(),
        verifyRawDigest: okRaw,
        verifyHexUtf8: okHexUtf8,
        walletAdapter: wallet?.adapter?.name,
      });
      if (!okRaw && !okHexUtf8) {
        console.error(
          '[submit-intent] Signature does NOT verify against the digest with the connected pubkey. ' +
            'The wallet either signed a different message (unsupported wrapping) or signed with a different key. ' +
            'Sending will be rejected by the relayer.'
        );
        throw new Error(
          `Wallet signature does not match digest under ${publicKey.toBase58()}. ` +
            `Wallet=${wallet?.adapter?.name ?? 'unknown'}. ` +
            `Try a different wallet (Phantom/Solflare/Backpack), or if using a hardware wallet, ` +
            `enable blind-signing for off-chain messages.`
        );
      }
    } catch (verifyErr) {
      if (
        verifyErr instanceof Error &&
        verifyErr.message.startsWith('Wallet signature does not match')
      ) {
        throw verifyErr;
      }

      console.warn('[submit-intent] client-verify import/run failed:', verifyErr);
    }
    const signedIntentAt = performance.now();

    const bridgeUrl = config.devnet.gatewayUrl;
    const relayPayload = {
      group: params.group,
      // The HTTP bridge rejects empty execution_queue with "missing required
      // fields", so send the v5 address even though the digest excludes it.
      execution_queue: v5ExecutionQueue,
      market: params.market,
      intent_version: RELAY_INTENT_VERSION,
      target_kind: IntentTargetKind.PerpMarket,
      target_index: targetIndex,
      // Mirror cont-sdk-fresh/trading.ts: send both fields. The HTTP bridge / older
      // relayer builds may still read `base_fee`; v5 reads `max_fee_lamports`.
      base_fee: 'AUTO',
      max_fee_lamports: 'AUTO',
      payload_b64: bytesToBase64(params.payloadBytes),
      remaining_accounts: params.remainingAccounts,
      min_execute_slot: '0',
      expires_at_slot: '0',
      user_owner: publicKey.toBase58(),
      mango_account: params.mangoAccount,
      user_signature_b64: bytesToBase64(signatureBytes),
      client_order_id: intentClientOrderId.toString(),
    };
    // Invite-only gate: the proxy requires a wallet-bound bearer token on the
    // submit-intent route. Gate is established on wallet connect via
    // useAccessGate; if absent here, the user is mid-flow and we abort with a
    // clear error rather than letting the request 401 deep inside axios.
    const walletAuthToken = getWalletAuthToken(publicKey.toBase58());
    if (!walletAuthToken) {
      throw new Error('Access not granted. Please complete wallet sign-in.');
    }
    const relayHeaders = { 'x-wallet-auth': walletAuthToken } as const;
    let relayResponse;
    for (let attempt = 0; attempt <= RELAY_DUPLICATE_SEQUENCE_RETRIES; attempt += 1) {
      try {
        relayResponse = await axios.post(`${bridgeUrl}${API_ROUTES.tx}`, relayPayload, {
          headers: relayHeaders,
        });
        break;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const detail = formatRelaySubmitError(error);
          // "already been processed" means the tx was already confirmed on-chain
          // from a prior submission — treat as success rather than surfacing an error.
          if (detail.toLowerCase().includes('already been processed')) {
            relayResponse = { data: { tx_signature: null } };
            break;
          }
          const shouldRetry =
            attempt < RELAY_DUPLICATE_SEQUENCE_RETRIES && isDuplicateSequenceRelayError(detail);
          if (shouldRetry) {
            await sleep(150 * (attempt + 1));
            continue;
          }
          throw new Error(`relay submit failed: ${detail}`);
        }
        throw error;
      }
    }
    const relaySubmittedAt = performance.now();

    logPerf('submit-intent', {
      build_intent_ms: Math.round(builtIntentAt - startedAt),
      sign_intent_ms: Math.round(signedIntentAt - builtIntentAt),
      relay_submit_ms: Math.round(relaySubmittedAt - signedIntentAt),
      total_ms: Math.round(relaySubmittedAt - startedAt),
    });

    return {
      success: true,
      txSignature: relayResponse.data?.tx_signature ?? undefined,
      acceptedLatencyMs: relayResponse.data?.accepted_latency_ms ?? undefined,
    };
  };

  const buildPlacePayload = (params: {
    side: OrderSide;
    price: number;
    size: number;
    reduceOnly: boolean;
    orderType: QueuePlaceOrderType;
    clientOrderId: bigint;
    marketMeta: {
      base_decimals: number;
      quote_decimals: number;
      base_lot_size: number;
      quote_lot_size: number;
    };
  }): Uint8Array => {
    if (!selectedMarket) {
      throw new Error('Selected market not found');
    }

    const baseDecimals = params.marketMeta.base_decimals;
    const quoteDecimals = params.marketMeta.quote_decimals;
    const baseLotSize = params.marketMeta.base_lot_size;
    const quoteLotSize = params.marketMeta.quote_lot_size;

    const priceLots = uiPriceToLots({
      uiPrice: params.price,
      baseDecimals,
      quoteDecimals,
      baseLotSize,
      quoteLotSize,
    });
    const maxBaseLots = uiBaseToLots({
      uiQuantity: params.size,
      baseDecimals,
      baseLotSize,
    });

    const quoteValue = Math.max(params.price * params.size * 1.1, 0);
    const maxQuoteLots = uiQuoteToLots({
      uiQuote: quoteValue,
      quoteDecimals,
      quoteLotSize,
    });

    return encodePerpPlaceOrderV2QueuePayload({
      side: sideToQueueSide(params.side),
      priceLots,
      maxBaseLots,
      maxQuoteLots,
      clientOrderId: params.clientOrderId,
      orderType: params.orderType,
      selfTradeBehavior: QueueSelfTradeBehavior.DecrementTake,
      reduceOnly: params.reduceOnly,
      expiryTimestamp: 0n,
      limit: 20,
    });
  };

  const openPosition = async ({
    side,
    price,
    size,
  }: PerpsSubmitOrderParams): Promise<{ success: boolean; error?: string }> => {
    const priceValue = Number(price);
    const sizeValue = Number(size);
    try {
      if (!publicKey || !signMessage) {
        throw new Error('Wallet not connected');
      }
      if (!selectedMarket) {
        throw new Error('Selected market not found');
      }
      if (!Number.isFinite(priceValue) || priceValue <= 0) {
        throw new Error('Invalid price');
      }
      if (!Number.isFinite(sizeValue) || sizeValue <= 0) {
        throw new Error('Invalid size');
      }

      const targetIndex = Number(selectedMarketId);
      const [marketMeta, canonical] = await Promise.all([
        resolveExecutionMarketParams(),
        resolveCanonicalAccountsForMarket(targetIndex),
      ]);

      const payloadBytes = buildPlacePayload({
        side,
        price: priceValue,
        size: sizeValue,
        reduceOnly: false,
        orderType: QueuePlaceOrderType.Limit,
        clientOrderId: randomU64(),
        marketMeta,
      });

      const result = await submitIntent({
        payloadBytes,
        remainingAccounts: canonical.remainingAccounts,
        group: canonical.group,
        market: selectedMarketId,
        mangoAccount: canonical.mangoAccount,
      });

      showOrderToast(`${side} order placed`, result.txSignature, result.acceptedLatencyMs);
      posthog.capture('perp_limit_order_placed', {
        market: selectedMarket?.name,
        market_id: selectedMarket?.uuid,
        side,
        price: priceValue,
        size: sizeValue,
        wallet: publicKey?.toBase58(),
      });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(error instanceof Error ? error.message : 'Failed to place order');
      posthog.capture('perp_limit_order_failed', {
        market: selectedMarket?.name,
        market_id: selectedMarket?.uuid,
        side,
        price: priceValue,
        size: sizeValue,
        error_message: errorMessage,
        wallet: publicKey?.toBase58(),
      });
      return { success: false, error: errorMessage };
    }
  };

  const openMarketPosition = async ({
    side,
    size,
    maxSlippageBps,
    markPrice,
  }: PerpsMarketOrderParams): Promise<{ success: boolean; error?: string }> => {
    const sizeValue = Number(size);
    try {
      if (!publicKey || !signMessage) {
        throw new Error('Wallet not connected');
      }
      if (!selectedMarket) {
        throw new Error('Selected market not found');
      }
      if (!Number.isFinite(sizeValue) || sizeValue <= 0) {
        throw new Error('Invalid size');
      }
      if (!Number.isFinite(markPrice) || markPrice <= 0) {
        throw new Error('Mark price unavailable');
      }

      const targetIndex = Number(selectedMarketId);
      const [marketMeta, canonical] = await Promise.all([
        resolveExecutionMarketParams(),
        resolveCanonicalAccountsForMarket(targetIndex),
      ]);

      const slippageFraction = Math.max(0, maxSlippageBps) / 10_000;
      const slippageMultiplier = side === 'Buy' ? 1 + slippageFraction : 1 - slippageFraction;
      const effectivePrice = markPrice * slippageMultiplier;
      const payloadBytes = buildPlacePayload({
        side,
        price: effectivePrice,
        size: sizeValue,
        reduceOnly: false,
        orderType: QueuePlaceOrderType.Market,
        clientOrderId: randomU64(),
        marketMeta,
      });

      const result = await submitIntent({
        payloadBytes,
        remainingAccounts: canonical.remainingAccounts,
        group: canonical.group,
        market: selectedMarketId,
        mangoAccount: canonical.mangoAccount,
      });

      showOrderToast(`Market ${side} order placed`, result.txSignature, result.acceptedLatencyMs);
      posthog.capture('perp_market_order_placed', {
        market: selectedMarket?.name,
        market_id: selectedMarket?.uuid,
        side,
        size: sizeValue,
        mark_price: markPrice,
        max_slippage_bps: maxSlippageBps,
        wallet: publicKey?.toBase58(),
      });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(error instanceof Error ? error.message : 'Failed to place market order');
      posthog.capture('perp_market_order_failed', {
        market: selectedMarket?.name,
        market_id: selectedMarket?.uuid,
        side,
        size: sizeValue,
        mark_price: markPrice,
        max_slippage_bps: maxSlippageBps,
        error_message: errorMessage,
        wallet: publicKey?.toBase58(),
      });
      return { success: false, error: errorMessage };
    }
  };

  const closePosition = async ({
    side,
    size,
    mode,
    markPrice,
    maxSlippageBps,
    limitPrice,
  }: PerpsClosePositionParams): Promise<{ success: boolean; error?: string }> => {
    const sizeValue = Number(size);
    const closeMode: 'market' | 'limit' = mode === 'market' ? 'market' : 'limit';
    try {
      if (!publicKey || !signMessage) {
        throw new Error('Wallet not connected');
      }
      if (!selectedMarket) {
        throw new Error('Selected market not found');
      }
      if (!Number.isFinite(sizeValue) || sizeValue <= 0) {
        throw new Error('Invalid close size');
      }

      let priceValue: number;
      let orderType: QueuePlaceOrderType;

      if (closeMode === 'market') {
        if (!Number.isFinite(markPrice) || markPrice <= 0) {
          throw new Error('Invalid close mark price');
        }
        const slippageBps = Number.isFinite(maxSlippageBps) ? Math.max(0, maxSlippageBps) : 50;
        const slippageFraction = slippageBps / 10_000;
        priceValue = markPrice * (side === 'Buy' ? 1 + slippageFraction : 1 - slippageFraction);
        if (!Number.isFinite(priceValue) || priceValue <= 0) {
          throw new Error('Invalid close price');
        }
        orderType = QueuePlaceOrderType.ImmediateOrCancel;
      } else {
        priceValue = Number(limitPrice);
        if (!Number.isFinite(priceValue) || priceValue <= 0) {
          throw new Error('Invalid close limit price');
        }
        orderType = QueuePlaceOrderType.Limit;
      }

      const targetIndex = Number(selectedMarketId);
      const [marketMeta, canonical] = await Promise.all([
        resolveExecutionMarketParams(),
        resolveCanonicalAccountsForMarket(targetIndex),
      ]);

      const payloadBytes = buildPlacePayload({
        side,
        price: priceValue,
        size: sizeValue,
        reduceOnly: true,
        orderType,
        clientOrderId: randomU64(),
        marketMeta,
      });

      const result = await submitIntent({
        payloadBytes,
        remainingAccounts: canonical.remainingAccounts,
        group: canonical.group,
        market: selectedMarketId,
        mangoAccount: canonical.mangoAccount,
      });

      showOrderToast(
        closeMode === 'market' ? 'Close market order submitted' : 'Close limit order submitted',
        result.txSignature,
        result.acceptedLatencyMs
      );
      posthog.capture('perp_position_closed', {
        market: selectedMarket?.name,
        market_id: selectedMarket?.uuid,
        side,
        size: sizeValue,
        close_mode: closeMode,
        wallet: publicKey?.toBase58(),
      });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(error instanceof Error ? error.message : 'Failed to close position');
      posthog.capture('perp_position_close_failed', {
        market: selectedMarket?.name,
        market_id: selectedMarket?.uuid,
        side,
        size: sizeValue,
        close_mode: closeMode,
        error_message: errorMessage,
        wallet: publicKey?.toBase58(),
      });
      return { success: false, error: errorMessage };
    }
  };

  const cancelOrder = async (orderId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!publicKey || !signMessage) {
        throw new Error('Wallet not connected');
      }
      if (!selectedMarket) {
        throw new Error('Selected market not found');
      }

      const targetIndex = Number(selectedMarketId);
      const canonical = await resolveCanonicalAccountsForMarket(targetIndex);
      const payloadBytes = encodePerpCancelOrderQueuePayload(BigInt(orderId));
      const result = await submitIntent({
        payloadBytes,
        remainingAccounts: canonical.remainingAccounts,
        group: canonical.group,
        market: selectedMarketId,
        mangoAccount: canonical.mangoAccount,
      });

      showOrderToast('Order cancelled', result.txSignature, result.acceptedLatencyMs);
      posthog.capture('perp_order_cancelled', {
        market: selectedMarket?.name,
        market_id: selectedMarket?.uuid,
        order_id: orderId,
        wallet: publicKey?.toBase58(),
      });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(error instanceof Error ? error.message : 'Failed to cancel order');
      posthog.capture('perp_order_cancel_failed', {
        market: selectedMarket?.name,
        market_id: selectedMarket?.uuid,
        order_id: orderId,
        error_message: errorMessage,
        wallet: publicKey?.toBase58(),
      });
      return { success: false, error: errorMessage };
    }
  };

  return {
    openPosition,
    openMarketPosition,
    closePosition,
    cancelOrder,
  };
}
