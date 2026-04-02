/**
 * Jotai atoms for SSE-sourced data
 */
import { atom } from 'jotai';
import type { SSEConnectionState, SSEMarketMetrics, SSETradeSummary } from './sse-types';
import type { Order, Trade } from './useSequencerApi';
import type { RecentTrade } from './sse-atom-bridge';
import type { Position } from '@/shared/hooks/usePositions';
import type { MarginAccount } from '@/shared/hooks/useAccount';

export const sseConnectionStateAtom = atom<SSEConnectionState>('disconnected');

export const marketMetricsAtom = atom<SSEMarketMetrics | null>(null);

export const marketTradeSummaryAtom = atom<SSETradeSummary | null>(null);

export const userOpenOrdersAtom = atom<Order[]>([]);

export const userTradesAtom = atom<Trade[]>([]);

export const userPositionsAtom = atom<Position[]>([]);

export const accountMetricsAtom = atom<MarginAccount | null>(null);

// Recent market trades (all participants, not just the connected user).
// Fed by the /state/stream/trades SSE endpoint.
export const recentMarketTradesAtom = atom<RecentTrade[]>([]);
