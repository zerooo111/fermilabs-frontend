/**
 * v2 composite SSE client — subscribes to `/v2/stream/frontend/:market?owner=X`.
 *
 * Replaces the `v2-sse-client.ts` + `tradesClient` + REST-poll-account trio
 * with a single connection that multiplexes:
 *
 *   event: hello      – connection ack (ignored)
 *   event: book       – orderbook snapshot on change (every ~250ms)
 *   event: meta       – market pricing on change (every ~2s)
 *   event: trade      – live fill from v1:trades:<market>
 *   event: intent     – relay_intent_status / queue_item_* from v1:events:<market>
 *   event: account    – balance + position + orders snapshot on change (every ~1s)
 *   event: ready      – initial burst complete
 *   event: resync     – broadcast buffer lag; consumer should re-snapshot
 *
 * Event payloads carry the whole snapshot so consumers can update atoms
 * directly without a REST refetch (except the `book` event, which today
 * carries only price+order_id; consumers keep the debounced /v2/snapshot
 * fallback for book detail).
 */
import { config, API_ROUTES_V2 } from '@/shared/config/constants';
import type { SSEConnectionState } from './sse-types';

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const STALE_TIMEOUT_MS = 15_000;

export type V2CompositeEventType =
  | 'hello'
  | 'book'
  | 'meta'
  | 'trade'
  | 'intent'
  | 'account'
  | 'ready'
  | 'resync';

export interface V2CompositeEvent<T = unknown> {
  id: string;
  event_type: V2CompositeEventType;
  data: T;
}

export interface V2CompositeCallbacks {
  onBook?: (data: unknown) => void;
  onMeta?: (data: unknown) => void;
  onTrade?: (data: unknown) => void;
  onIntent?: (data: unknown) => void;
  onAccount?: (data: unknown) => void;
  onReady?: () => void;
  onResync?: () => void;
  onStateChange?: (state: SSEConnectionState) => void;
}

export class V2CompositeSSEClient {
  private eventSource: EventSource | null = null;
  private market: string | null = null;
  private owner: string | null = null;
  private state: SSEConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private staleTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  callbacks: V2CompositeCallbacks = {};

  connect(market: string, owner: string | null) {
    this.market = market;
    this.owner = owner;
    this.reconnectAttempts = 0;
    this.openConnection();
  }

  disconnect() {
    this.closeConnection();
    this.clearReconnectTimer();
    this.clearStaleTimer();
    this.setState('disconnected');
  }

  switchMarket(market: string) {
    if (this.market === market) return;
    this.market = market;
    this.reconnectAttempts = 0;
    this.closeConnection();
    this.clearReconnectTimer();
    this.openConnection();
  }

  switchOwner(owner: string | null) {
    if (this.owner === owner) return;
    this.owner = owner;
    if (this.state === 'disconnected') return;
    // Owner changes require a new connection because ?owner= is attached at
    // connect time on the gateway.
    this.reconnectAttempts = 0;
    this.closeConnection();
    this.clearReconnectTimer();
    this.openConnection();
  }

  getState(): SSEConnectionState {
    return this.state;
  }

  destroy() {
    this.destroyed = true;
    this.disconnect();
  }

  private buildUrl(): string {
    const path = API_ROUTES_V2.stream_frontend.replace('{marketId}', this.market ?? '');
    const base = `${config.devnet.gatewayUrl}${path}`;
    if (this.owner) return `${base}?owner=${encodeURIComponent(this.owner)}`;
    return base;
  }

  private openConnection() {
    if (this.destroyed || !this.market) return;
    this.closeConnection();
    this.setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    const es = new EventSource(this.buildUrl());
    this.eventSource = es;

    const handlers: Array<[V2CompositeEventType, (data: unknown) => void]> = [
      ['book', d => this.callbacks.onBook?.(d)],
      ['meta', d => this.callbacks.onMeta?.(d)],
      ['trade', d => this.callbacks.onTrade?.(d)],
      ['intent', d => this.callbacks.onIntent?.(d)],
      ['account', d => this.callbacks.onAccount?.(d)],
    ];
    for (const [name, fn] of handlers) {
      es.addEventListener(name, (e: MessageEvent) => {
        this.resetStaleTimer();
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(e.data);
        } catch {
          /* ignore malformed */
        }
        fn(parsed);
      });
    }
    es.addEventListener('hello', () => {
      this.resetStaleTimer();
    });
    es.addEventListener('ready', () => {
      this.resetStaleTimer();
      this.callbacks.onReady?.();
    });
    es.addEventListener('resync', () => {
      this.resetStaleTimer();
      this.callbacks.onResync?.();
    });

    es.onopen = () => {
      this.reconnectAttempts = 0;
      this.setState('connected');
      this.resetStaleTimer();
    };
    es.onerror = () => {
      this.closeConnection();
      this.scheduleReconnect();
    };
  }

  private closeConnection() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.clearStaleTimer();
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    this.clearReconnectTimer();
    const base = Math.min(INITIAL_BACKOFF_MS * 2 ** this.reconnectAttempts, MAX_BACKOFF_MS);
    const delay = base + Math.random() * base * 0.3;
    this.reconnectAttempts++;
    this.setState('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openConnection();
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private resetStaleTimer() {
    this.clearStaleTimer();
    this.staleTimer = setTimeout(() => {
      this.closeConnection();
      this.scheduleReconnect();
    }, STALE_TIMEOUT_MS);
  }

  private clearStaleTimer() {
    if (this.staleTimer) {
      clearTimeout(this.staleTimer);
      this.staleTimer = null;
    }
  }

  private setState(state: SSEConnectionState) {
    if (this.state === state) return;
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }
}

let instance: V2CompositeSSEClient | null = null;

export function getV2CompositeClient(): V2CompositeSSEClient {
  if (!instance) instance = new V2CompositeSSEClient();
  return instance;
}

export function resetV2CompositeClient(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
