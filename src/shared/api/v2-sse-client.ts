/**
 * v2 SSE client — subscribes to `/v2/events/:marketId` on the gateway.
 *
 * Unlike the legacy /state/stream/frontend stream, v2 carries raw harness
 * mutation events (one of `relay_intent_accepted`, `relay_intent_status`,
 * `queue_item_enqueued`, `queue_item_processed`) plus a `resync` marker when
 * the server-side broadcast buffer lags. Consumers treat each event as an
 * invalidation signal and re-fetch snapshots via `/v2/snapshot/*`.
 *
 * Resume: EventSource automatically sends `Last-Event-ID` on reconnect; the
 * gateway accepts that and replays from the last seen stream id up to
 * MAX_BACKFILL. We also set `?from=` on manual reconnect paths as a belt-
 * and-suspenders fallback.
 */
import { config, API_ROUTES_V2 } from '@/shared/config/constants';
import type { SSEConnectionState } from './sse-types';

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const STALE_TIMEOUT_MS = 15_000;

export type V2EventType =
  | 'relay_intent_accepted'
  | 'relay_intent_status'
  | 'queue_item_enqueued'
  | 'queue_item_processed'
  | 'reconciliation'
  | 'resync'
  | 'backfill_error';

export interface V2StreamEvent {
  /** Redis stream id — use this as the resume cursor. */
  id: string;
  event_type: V2EventType | string;
  view?: 'opt' | 'conf';
  ts_ms?: number;
  sequence?: number;
  /** Parsed JSON payload. Shape depends on event_type — consumers do not
   *  interpret this directly; they treat the event as an invalidation
   *  signal and re-fetch snapshots. */
  payload?: unknown;
  /** Raw field map in case a future consumer needs it. */
  raw: Record<string, unknown>;
}

export interface V2SSECallbacks {
  onEvent?: (ev: V2StreamEvent) => void;
  onResync?: () => void;
  onStateChange?: (state: SSEConnectionState) => void;
}

export class V2SSEClient {
  private eventSource: EventSource | null = null;
  private market: string | null = null;
  private lastEventId: string | null = null;
  private state: SSEConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private staleTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  callbacks: V2SSECallbacks = {};

  connect(market: string) {
    this.market = market;
    this.reconnectAttempts = 0;
    this.lastEventId = null;
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
    this.lastEventId = null;
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
    const path = API_ROUTES_V2.events.replace('{marketId}', this.market ?? '');
    const base = `${config.devnet.gatewayUrl}${path}`;
    // EventSource sends `Last-Event-ID` automatically on reconnect via the
    // native retry loop, but we drive our own reconnects; `?from=` covers
    // both the manual reconnect path and user agents that drop the header
    // after EventSource.close().
    if (this.lastEventId) {
      return `${base}?from=${encodeURIComponent(this.lastEventId)}`;
    }
    return base;
  }

  private openConnection() {
    if (this.destroyed || !this.market) return;
    this.closeConnection();

    this.setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    const es = new EventSource(this.buildUrl());
    this.eventSource = es;

    const eventTypes: V2EventType[] = [
      'relay_intent_accepted',
      'relay_intent_status',
      'queue_item_enqueued',
      'queue_item_processed',
      'reconciliation',
      'backfill_error',
    ];
    for (const t of eventTypes) {
      es.addEventListener(t, (e: MessageEvent) => this.handleEvent(t, e));
    }
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

  private handleEvent(eventType: V2EventType, e: MessageEvent) {
    this.resetStaleTimer();

    if (e.lastEventId) this.lastEventId = e.lastEventId;

    let obj: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(e.data);
      if (parsed && typeof parsed === 'object') obj = parsed as Record<string, unknown>;
    } catch {
      // Malformed payload — fire the event anyway so consumers still
      // treat it as an invalidation signal.
    }

    const ev: V2StreamEvent = {
      id: e.lastEventId || '',
      event_type: (obj.event_type as string) || eventType,
      view: (obj.view as 'opt' | 'conf' | undefined) ?? undefined,
      ts_ms: typeof obj.ts_ms === 'string' ? Number(obj.ts_ms) : (obj.ts_ms as number | undefined),
      sequence:
        typeof obj.sequence === 'string'
          ? Number(obj.sequence)
          : (obj.sequence as number | undefined),
      payload: obj.payload,
      raw: obj,
    };
    this.callbacks.onEvent?.(ev);
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

let instance: V2SSEClient | null = null;

export function getV2SSEClient(): V2SSEClient {
  if (!instance) instance = new V2SSEClient();
  return instance;
}

export function resetV2SSEClient(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
