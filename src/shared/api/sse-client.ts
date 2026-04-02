/**
 * SSE Client — framework-agnostic EventSource connection manager
 * Handles reconnection with exponential backoff, tab visibility, stale detection.
 *
 * Callbacks are read through a mutable ref pattern: the hook updates
 * `callbacks` at any time and the client always reads the latest version.
 */
import { config } from '@/shared/config/constants';
import type {
  SSECallbacks,
  SSETradesCallbacks,
  SSEConnectionState,
  SSEConnectedEvent,
  SSESnapshotEvent,
  SSEAccountUpdateEvent,
  SSEMarketUpdateEvent,
} from './sse-types';

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const STALE_TIMEOUT_MS = 15_000;
const TAB_HIDDEN_CLOSE_MS = 60_000;

export class SSEClient {
  private eventSource: EventSource | null = null;
  private market: string | null = null;
  private owner: string | null = null;
  private state: SSEConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private staleTimer: ReturnType<typeof setTimeout> | null = null;
  private hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  /**
   * Mutable callback ref — the hook overwrites this object's properties
   * at any time. The client always reads through this reference, so
   * callbacks are never stale.
   */
  callbacks: SSECallbacks = {};

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  // --- Public API ---

  connect(market: string, owner?: string | null) {
    this.market = market;
    this.owner = owner ?? null;
    this.reconnectAttempts = 0;
    this.openConnection();
  }

  disconnect() {
    this.closeConnection();
    this.clearReconnectTimer();
    this.clearStaleTimer();
    this.clearHiddenTimer();
    this.setState('disconnected');
  }

  switchMarket(market: string) {
    if (this.market === market) return;
    this.market = market;
    this.reconnectAttempts = 0;
    this.reopenConnection();
  }

  switchOwner(owner: string | null) {
    if (this.owner === owner) return;
    this.owner = owner;
    this.reconnectAttempts = 0;
    this.reopenConnection();
  }

  getState(): SSEConnectionState {
    return this.state;
  }

  destroy() {
    this.destroyed = true;
    this.disconnect();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  // --- Connection lifecycle ---

  private buildUrl(): string {
    const base = `${config.devnet.gatewayUrl}/state/stream/frontend`;
    const params = new URLSearchParams();
    if (this.market) params.set('market', this.market);
    if (this.owner) params.set('owner', this.owner);
    return `${base}?${params.toString()}`;
  }

  private openConnection() {
    if (this.destroyed) return;
    this.closeConnection();

    const url = this.buildUrl();
    this.setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    const es = new EventSource(url);
    this.eventSource = es;

    es.addEventListener('connected', (e: MessageEvent) => {
      this.handleEvent('connected', e);
    });
    es.addEventListener('snapshot', (e: MessageEvent) => {
      this.handleEvent('snapshot', e);
    });
    es.addEventListener('account_update', (e: MessageEvent) => {
      this.handleEvent('account_update', e);
    });
    es.addEventListener('market_update', (e: MessageEvent) => {
      this.handleEvent('market_update', e);
    });

    es.onerror = () => {
      this.closeConnection();
      this.scheduleReconnect();
    };

    this.resetStaleTimer();
  }

  private closeConnection() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.clearStaleTimer();
  }

  private reopenConnection() {
    this.closeConnection();
    this.clearReconnectTimer();
    this.openConnection();
  }

  // --- Event handling ---

  private handleEvent(type: string, e: MessageEvent) {
    this.resetStaleTimer();

    let data: unknown;
    try {
      data = JSON.parse(e.data);
    } catch {
      return;
    }

    switch (type) {
      case 'connected':
        this.reconnectAttempts = 0;
        this.setState('connected');
        this.callbacks.onConnected?.(data as SSEConnectedEvent);
        break;
      case 'snapshot':
        this.callbacks.onSnapshot?.(data as SSESnapshotEvent);
        break;
      case 'account_update':
        this.callbacks.onAccountUpdate?.(data as SSEAccountUpdateEvent);
        break;
      case 'market_update':
        this.callbacks.onMarketUpdate?.(data as SSEMarketUpdateEvent);
        break;
    }
  }

  // --- Reconnection with exponential backoff + jitter ---

  private scheduleReconnect() {
    if (this.destroyed) return;
    this.clearReconnectTimer();

    const base = Math.min(INITIAL_BACKOFF_MS * 2 ** this.reconnectAttempts, MAX_BACKOFF_MS);
    const jitter = Math.random() * base * 0.3;
    const delay = base + jitter;
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

  // --- Stale detection ---

  private resetStaleTimer() {
    this.clearStaleTimer();
    this.staleTimer = setTimeout(() => {
      this.reopenConnection();
    }, STALE_TIMEOUT_MS);
  }

  private clearStaleTimer() {
    if (this.staleTimer) {
      clearTimeout(this.staleTimer);
      this.staleTimer = null;
    }
  }

  // --- Tab visibility ---

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.clearHiddenTimer();
      this.hiddenTimer = setTimeout(() => {
        this.hiddenTimer = null;
        this.closeConnection();
        this.clearReconnectTimer();
        this.setState('disconnected');
      }, TAB_HIDDEN_CLOSE_MS);
    } else {
      this.clearHiddenTimer();
      if (!this.eventSource && this.market) {
        this.reconnectAttempts = 0;
        this.openConnection();
      }
    }
  };

  private clearHiddenTimer() {
    if (this.hiddenTimer) {
      clearTimeout(this.hiddenTimer);
      this.hiddenTimer = null;
    }
  }

  // --- State management ---

  private setState(state: SSEConnectionState) {
    if (this.state === state) return;
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }
}

/**
 * TradesSSEClient — manages the /state/stream/trades EventSource.
 * Simpler than the main client: no owner param, no account events.
 */
export class TradesSSEClient {
  private eventSource: EventSource | null = null;
  private market: string | null = null;
  private state: SSEConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private staleTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  callbacks: SSETradesCallbacks = {};

  connect(market: string) {
    this.market = market;
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

  getState(): SSEConnectionState {
    return this.state;
  }

  destroy() {
    this.destroyed = true;
    this.disconnect();
  }

  private buildUrl(): string {
    return `${config.devnet.gatewayUrl}/state/stream/trades?market=${this.market}`;
  }

  private openConnection() {
    if (this.destroyed || !this.market) return;
    this.closeConnection();

    this.setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
    const es = new EventSource(this.buildUrl());
    this.eventSource = es;

    es.addEventListener('connected', (e: MessageEvent) => {
      this.reconnectAttempts = 0;
      this.setState('connected');
      try {
        this.callbacks.onConnected?.(JSON.parse(e.data));
      } catch {
        /* ignore parse errors */
      }
      this.resetStaleTimer();
    });

    es.addEventListener('snapshot', (e: MessageEvent) => {
      try {
        this.callbacks.onSnapshot?.(JSON.parse(e.data));
      } catch {
        /* ignore */
      }
      this.resetStaleTimer();
    });

    es.addEventListener('trade', (e: MessageEvent) => {
      try {
        this.callbacks.onTrade?.(JSON.parse(e.data));
      } catch {
        /* ignore */
      }
      this.resetStaleTimer();
    });

    // Also listen for 'trades' in case the server uses plural
    es.addEventListener('trades', (e: MessageEvent) => {
      try {
        this.callbacks.onTrade?.(JSON.parse(e.data));
      } catch {
        /* ignore */
      }
      this.resetStaleTimer();
    });

    es.onerror = () => {
      this.closeConnection();
      this.scheduleReconnect();
    };

    this.resetStaleTimer();
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
      this.clearReconnectTimer();
      this.openConnection();
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

// Singleton instances
let instance: SSEClient | null = null;

export function getSSEClient(): SSEClient {
  if (!instance) {
    instance = new SSEClient();
  }
  return instance;
}

export function resetSSEClient(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}

let tradesInstance: TradesSSEClient | null = null;

export function getTradesSSEClient(): TradesSSEClient {
  if (!tradesInstance) {
    tradesInstance = new TradesSSEClient();
  }
  return tradesInstance;
}

export function resetTradesSSEClient(): void {
  if (tradesInstance) {
    tradesInstance.destroy();
    tradesInstance = null;
  }
}
