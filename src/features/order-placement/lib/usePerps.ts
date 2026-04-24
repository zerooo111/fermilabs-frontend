import { toast } from 'sonner';
import axios from 'axios';
import posthog from 'posthog-js';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelectedMarket } from '@/entities/market';
import { config, API_ROUTES, API_ROUTES_V2 } from '@/shared/config/constants';
import {
  buildExecutionQueueUserIntent,
  bytesToBase64,
  encodePerpCancelOrderQueuePayload,
  encodePerpPlaceOrderV2QueuePayload,
  IntentTargetKind,
  QueuePlaceOrderType,
  QueueSelfTradeBehavior,
  QueueSide,
  uiBaseToLots,
  uiPriceToLots,
  uiQuoteToLots,
} from '@/shared/lib/mango-execution-queue';
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

type RelayConfigResponse = {
  group: string | null;
  execution_queue: string | null;
  market: string;
  mango_account: string | null;
  owner_to_mango_account: Record<string, string>;
  lanes: Array<{
    name: string;
    remaining_accounts: Array<{
      pubkey: string;
      is_signer: boolean;
      is_writable: boolean;
    }>;
  }>;
};

type HarnessOwnerBalancesResponse = {
  data?: {
    mango_accounts?: string[];
  };
};

type DepositContextResponse = {
  owner: string;
  mango_account: string;
  mango_account_exists: boolean;
};

type ResolvedRelayConfig = {
  configData: RelayConfigResponse;
  group: string;
  executionQueue: string;
  market: string;
  mangoAccount: string;
};

type ExecutionMarketParams = {
  base_decimals: number;
  quote_decimals: number;
  base_lot_size: number;
  quote_lot_size: number;
};

type HarnessFullMarketsResponse = {
  market_metadata?: Record<string, HarnessMarketMetadata>;
};

const RELAY_CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;
const MARKET_META_CACHE_TTL_MS = 60 * 60 * 1000;
const RELAY_DUPLICATE_SEQUENCE_RETRIES = 2;
const RELAY_INTENT_VERSION = 2;

function showOrderToast(title: string, txSignature?: string, acceptedLatencyMs?: number) {
  const explorer = txSignature
    ? `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`
    : null;
  const description = [
    acceptedLatencyMs !== undefined ? `Latency: ${acceptedLatencyMs.toFixed(1)} ms` : null,
    txSignature ? `Tx: ${txSignature.slice(0, 8)}…${txSignature.slice(-6)}` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  toast.success(title, {
    duration: Infinity,
    description: description || undefined,
    ...(explorer
      ? {
          action: {
            label: 'Explorer',
            onClick: () => window.open(explorer, '_blank', 'noopener,noreferrer'),
          },
        }
      : {}),
  });
}

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

  return detail;
}

function sideToQueueSide(side: OrderSide): QueueSide {
  return side === 'Buy' ? QueueSide.Bid : QueueSide.Ask;
}

function pickPlaceLane(
  lanes: RelayConfigResponse['lanes'],
  side: OrderSide
): RelayConfigResponse['lanes'][number] | null {
  if (!lanes.length) return null;
  if (side === 'Buy') {
    return (
      lanes.find(lane => /bid|buy|maker/i.test(lane.name)) ||
      lanes.find(lane => /place/i.test(lane.name)) ||
      lanes[0]
    );
  }
  return (
    lanes.find(lane => /ask|sell|taker/i.test(lane.name)) ||
    lanes.find(lane => /place/i.test(lane.name)) ||
    lanes[0]
  );
}

function pickCancelLane(
  lanes: RelayConfigResponse['lanes']
): RelayConfigResponse['lanes'][number] | null {
  if (!lanes.length) return null;
  return lanes.find(lane => /cancel/i.test(lane.name)) || lanes[0];
}

function remapLaneAccountsForOwner(
  laneAccounts: RelayConfigResponse['lanes'][number]['remaining_accounts'],
  configData: RelayConfigResponse,
  ownerPubkey: string,
  ownerMangoAccount: string
): RelayConfigResponse['lanes'][number]['remaining_accounts'] {
  if (!ownerMangoAccount) return laneAccounts;
  const knownMangoAccounts = new Set<string>();
  const knownOwners = new Set<string>();
  if (configData.mango_account) knownMangoAccounts.add(configData.mango_account);
  Object.entries(configData.owner_to_mango_account || {}).forEach(([owner, pk]) => {
    if (owner) knownOwners.add(owner);
    if (pk) knownMangoAccounts.add(pk);
  });

  const remappedAccounts = laneAccounts.map(account =>
    knownMangoAccounts.has(account.pubkey)
      ? { ...account, pubkey: ownerMangoAccount }
      : knownOwners.has(account.pubkey)
        ? { ...account, pubkey: ownerPubkey }
        : account
  );

  // For execution-queue place/cancel lanes, slot [1] is the user's mango account
  // and slot [2] is the owner. Force those slots so stale lane templates do not
  // survive if the backend serves an outdated lane file.
  if (remappedAccounts.length >= 3) {
    remappedAccounts[1] = { ...remappedAccounts[1], pubkey: ownerMangoAccount };
    remappedAccounts[2] = { ...remappedAccounts[2], pubkey: ownerPubkey };
  }

  return remappedAccounts;
}

export function usePerps() {
  const { publicKey, signMessage, wallet } = useWallet();
  const { selectedMarket } = useSelectedMarket();
  const owner = publicKey?.toBase58() || '';
  const selectedMarketId = selectedMarket?.uuid || config.devnet.defaultHarnessMarketId;
  const hasSelectedMarket = Boolean(selectedMarket);
  const fallbackBaseDecimals = Number(selectedMarket?.base_decimals ?? config.devnet.baseDecimals);
  const fallbackQuoteDecimals = Number(
    selectedMarket?.quote_decimals ?? config.devnet.quoteDecimals
  );
  const fallbackBaseLotSize = Number(selectedMarket?.base_lot_size ?? config.devnet.baseLotSize);
  const fallbackQuoteLotSize = Number(selectedMarket?.quote_lot_size ?? config.devnet.quoteLotSize);
  const relayConfigCacheRef = useRef<{
    owner: string;
    market: string;
    value: ResolvedRelayConfig;
    fetchedAtMs: number;
  } | null>(null);
  const relayConfigRequestRef = useRef<{
    owner: string;
    market: string;
    promise: Promise<ResolvedRelayConfig>;
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
  const [relayConfigState, setRelayConfigState] = useState<ResolvedRelayConfig | null>(null);

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
    const providerCandidates = [
      adapterAny?._wallet,
      maybeWindow?.phantom?.solana,
      maybeWindow?.solana,
    ].filter(Boolean) as any[];

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

    const adapterSig = await trySign('walletAdapter.signMessage', () => signMessage(message));
    if (adapterSig) {
      logPerf('wallet-sign', {
        strategy: 'wallet-adapter',
        sign_ms: Math.round(performance.now() - startedAt),
      });
      return adapterSig;
    }

    // Fallback path for providers that do not work through wallet-adapter.
    for (const provider of providerCandidates) {
      if (provider?.signMessage) {
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

    const adapterName = wallet?.adapter?.name || 'unknown';
    throw new Error(
      `Failed to sign canonical intent message (${message.length} bytes) via ${adapterName}. ${attemptedErrors.join(' | ') || 'No signer returned a signature'}`
    );
  };

  const resolveRelayConfig = useCallback(async (): Promise<ResolvedRelayConfig> => {
    if (!owner) {
      throw new Error('Wallet not connected');
    }

    const startedAt = performance.now();
    const bridgeUrl = config.devnet.gatewayUrl;
    const market = selectedMarketId;
    const cached = relayConfigCacheRef.current;
    if (
      cached &&
      cached.owner === owner &&
      cached.market === market &&
      Date.now() - cached.fetchedAtMs < RELAY_CONFIG_CACHE_TTL_MS
    ) {
      logPerf('relay-config', {
        strategy: 'cache-hit',
        resolve_ms: Math.round(performance.now() - startedAt),
      });
      return cached.value;
    }

    const inFlight = relayConfigRequestRef.current;
    if (inFlight && inFlight.owner === owner && inFlight.market === market) {
      logPerf('relay-config', {
        strategy: 'in-flight',
        resolve_ms: Math.round(performance.now() - startedAt),
      });
      return inFlight.promise;
    }

    const request = (async (): Promise<ResolvedRelayConfig> => {
      const response = await axios.get<RelayConfigResponse>(
        `${bridgeUrl}${API_ROUTES.relay_config}?owner=${encodeURIComponent(owner)}`
      );
      const configData = response.data;

      const group = configData.group || config.devnet.mangoGroupPk;
      const executionQueue = configData.execution_queue || config.devnet.mangoExecutionQueuePk;
      const resolvedMarket = market || configData.market || config.devnet.defaultHarnessMarketId;
      let mangoAccount = configData.owner_to_mango_account?.[owner] || '';

      if (!mangoAccount) {
        try {
          const depositContextResponse = await axios.get<DepositContextResponse>(
            `${config.devnet.gatewayUrl}${API_ROUTES.deposit_context.replace('{pubkey}', owner)}`
          );
          const depositContext = depositContextResponse.data;
          if (depositContext && !depositContext.mango_account_exists) {
            throw new Error('Mango account missing; deposit first');
          }
          if (depositContext?.mango_account) {
            mangoAccount = depositContext.mango_account;
          }
        } catch (error) {
          if (error instanceof Error && error.message === 'Mango account missing; deposit first') {
            throw error;
          }
        }
      }

      if (!mangoAccount) {
        try {
          // v2 path: /v2/snapshot/account/:owner returns the full user snapshot
          // including margin_summary.accounts[].mango_account. Legacy
          // /state/balances kept behind the flag during rollout.
          if (config.devnet.useV2ReadLayer) {
            const accountResponse = await axios.get<{
              margin_summary?: {
                accounts?: Array<{ mango_account?: string }>;
              };
            }>(
              `${config.devnet.gatewayUrl}${API_ROUTES_V2.snapshot_account.replace('{owner}', encodeURIComponent(owner))}?view=optimistic`
            );
            const ownerMangoAccount =
              accountResponse.data?.margin_summary?.accounts?.[0]?.mango_account;
            if (ownerMangoAccount) {
              mangoAccount = ownerMangoAccount;
            }
          } else {
            const balancesResponse = await axios.get<HarnessOwnerBalancesResponse>(
              `${config.devnet.gatewayUrl}${API_ROUTES.user_balances.replace('{pubkey}', owner)}?view=optimistic&onchain=false`
            );
            const ownerMangoAccount = balancesResponse.data?.data?.mango_accounts?.[0];
            if (ownerMangoAccount) {
              mangoAccount = ownerMangoAccount;
            }
          }
        } catch {
          // Keep existing relay-config fallback when harness lookup fails.
        }
      }

      if (!mangoAccount) {
        mangoAccount = configData.mango_account || config.devnet.defaultMangoAccountPk;
      }

      if (!group || !executionQueue || !mangoAccount) {
        throw new Error('Missing relay bridge configuration (group/execution_queue/mango_account)');
      }

      const resolved: ResolvedRelayConfig = {
        configData,
        group,
        executionQueue,
        market: resolvedMarket,
        mangoAccount,
      };

      setRelayConfigState(resolved);
      relayConfigCacheRef.current = {
        owner,
        market,
        value: resolved,
        fetchedAtMs: Date.now(),
      };
      logPerf('relay-config', {
        strategy: 'network',
        resolve_ms: Math.round(performance.now() - startedAt),
      });
      return resolved;
    })();
    relayConfigRequestRef.current = {
      owner,
      market,
      promise: request,
    };
    try {
      return await request;
    } finally {
      if (relayConfigRequestRef.current?.promise === request) {
        relayConfigRequestRef.current = null;
      }
    }
  }, [logPerf, owner, selectedMarketId]);

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

  useEffect(() => {
    if (!owner) return;
    void resolveRelayConfig().catch(() => undefined);
  }, [owner, resolveRelayConfig]);

  useEffect(() => {
    if (!hasSelectedMarket) return;
    void resolveExecutionMarketParams().catch(() => undefined);
    if (owner) {
      void resolveRelayConfig().catch(() => undefined);
    }
  }, [hasSelectedMarket, owner, resolveExecutionMarketParams, resolveRelayConfig]);

  const submitIntent = async (params: {
    payloadBytes: Uint8Array;
    remainingAccounts: Array<{
      pubkey: string;
      is_signer: boolean;
      is_writable: boolean;
    }>;
    group: string;
    executionQueue: string;
    market: string;
    mangoAccount: string;
    priceForTick: number;
    sizeForTick: number;
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

    const startedAt = performance.now();
    const intent = await buildExecutionQueueUserIntent({
      group: params.group,
      executionQueue: params.executionQueue,
      mangoAccount: params.mangoAccount,
      userOwner: publicKey.toBase58(),
      payload: params.payloadBytes,
      remainingAccounts: params.remainingAccounts,
      intentVersion: RELAY_INTENT_VERSION,
      targetKind: IntentTargetKind.PerpMarket,
      targetIndex,
    });
    const builtIntentAt = performance.now();
    const signatureBytes = await signIntentMessage(intent.userIntentMessage);
    const signedIntentAt = performance.now();

    const bridgeUrl = config.devnet.gatewayUrl;
    const relayPayload = {
      group: params.group,
      execution_queue: params.executionQueue,
      market: params.market,
      intent_version: RELAY_INTENT_VERSION,
      target_kind: IntentTargetKind.PerpMarket,
      target_index: targetIndex,
      _base_fee: 'AUTO',
      payload_b64: bytesToBase64(params.payloadBytes),
      remaining_accounts: params.remainingAccounts,
      min_execute_slot: '0',
      expires_at_slot: '0',
      user_owner: publicKey.toBase58(),
      mango_account: params.mangoAccount,
      user_signature_b64: bytesToBase64(signatureBytes),
    };
    let relayResponse;
    for (let attempt = 0; attempt <= RELAY_DUPLICATE_SEQUENCE_RETRIES; attempt += 1) {
      try {
        relayResponse = await axios.post(`${bridgeUrl}${API_ROUTES.tx}`, relayPayload);
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

      const relay = await resolveRelayConfig();
      const marketMeta = await resolveExecutionMarketParams();
      const lane = pickPlaceLane(relay.configData.lanes, side);
      if (!lane) {
        throw new Error('No relay lane is configured for limit-order');
      }
      const remainingAccounts = remapLaneAccountsForOwner(
        lane.remaining_accounts,
        relay.configData,
        publicKey.toBase58(),
        relay.mangoAccount
      );

      const payloadBytes = buildPlacePayload({
        side,
        price: priceValue,
        size: sizeValue,
        reduceOnly: false,
        orderType: QueuePlaceOrderType.Limit,
        clientOrderId: BigInt(Date.now()),
        marketMeta,
      });

      const result = await submitIntent({
        payloadBytes,
        remainingAccounts,
        group: relay.group,
        executionQueue: relay.executionQueue,
        market: relay.market,
        mangoAccount: relay.mangoAccount,
        priceForTick: priceValue,
        sizeForTick: sizeValue,
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

      const relay = await resolveRelayConfig();
      const marketMeta = await resolveExecutionMarketParams();
      const lane = pickPlaceLane(relay.configData.lanes, side);
      if (!lane) {
        throw new Error('No relay lane is configured for market-order');
      }
      const remainingAccounts = remapLaneAccountsForOwner(
        lane.remaining_accounts,
        relay.configData,
        publicKey.toBase58(),
        relay.mangoAccount
      );

      const slippageFraction = Math.max(0, maxSlippageBps) / 10_000;
      const slippageMultiplier = side === 'Buy' ? 1 + slippageFraction : 1 - slippageFraction;
      const effectivePrice = markPrice * slippageMultiplier;
      const payloadBytes = buildPlacePayload({
        side,
        price: effectivePrice,
        size: sizeValue,
        reduceOnly: false,
        orderType: QueuePlaceOrderType.Market,
        clientOrderId: BigInt(Date.now()),
        marketMeta,
      });

      const result = await submitIntent({
        payloadBytes,
        remainingAccounts,
        group: relay.group,
        executionQueue: relay.executionQueue,
        market: relay.market,
        mangoAccount: relay.mangoAccount,
        priceForTick: markPrice,
        sizeForTick: sizeValue,
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

      const relay = await resolveRelayConfig();
      const marketMeta = await resolveExecutionMarketParams();
      const lane = pickPlaceLane(relay.configData.lanes, side);
      if (!lane) {
        throw new Error('No relay lane is configured for close-position');
      }
      const remainingAccounts = remapLaneAccountsForOwner(
        lane.remaining_accounts,
        relay.configData,
        publicKey.toBase58(),
        relay.mangoAccount
      );

      const payloadBytes = buildPlacePayload({
        side,
        price: priceValue,
        size: sizeValue,
        reduceOnly: true,
        orderType,
        clientOrderId: BigInt(Date.now()),
        marketMeta,
      });

      const result = await submitIntent({
        payloadBytes,
        remainingAccounts,
        group: relay.group,
        executionQueue: relay.executionQueue,
        market: relay.market,
        mangoAccount: relay.mangoAccount,
        priceForTick: closeMode === 'market' ? markPrice : priceValue,
        sizeForTick: sizeValue,
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

      const relay = await resolveRelayConfig();
      const lane = pickCancelLane(relay.configData.lanes);
      if (!lane) {
        throw new Error('No relay lane is configured for cancel-order');
      }
      const remainingAccounts = remapLaneAccountsForOwner(
        lane.remaining_accounts,
        relay.configData,
        publicKey.toBase58(),
        relay.mangoAccount
      );

      const payloadBytes = encodePerpCancelOrderQueuePayload(BigInt(orderId));
      const result = await submitIntent({
        payloadBytes,
        remainingAccounts,
        group: relay.group,
        executionQueue: relay.executionQueue,
        market: relay.market,
        mangoAccount: relay.mangoAccount,
        priceForTick: 0,
        sizeForTick: 0,
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
    relayConfig: relayConfigState,
  };
}
