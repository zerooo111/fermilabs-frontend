/**
 * Points queries. Balances move when an epoch is loaded or changes status
 * (weekly), and live estimates refresh a few times an hour, so a minute is
 * plenty.
 */
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAtom } from 'jotai';
import axios from 'axios';
import bs58 from 'bs58';

import {
  accessSessionAtom,
  clearSession,
  pointsSessionAtom,
  signInForPoints,
} from '@/features/access-gate';
import {
  claimPoints,
  prepareClaim,
  skipReadCache,
  fetchPointsAccount,
  fetchPointsAccountEpochs,
  fetchPointsActivity,
  fetchPointsEpochs,
  fetchPointsLeaderboard,
} from '../api/pointsClient';

const STALE_MS = 60_000;
export const ACTIVITY_PAGE = 25;

const pointsKey = ['points'] as const;

/** Don't hammer a 4xx (bad address, endpoint not deployed); retry network/5xx once. */
function retry(failures: number, err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    if (status && status >= 400 && status < 500) return false;
  }
  return failures < 1;
}

export function usePointsEpochs() {
  return useQuery({
    queryKey: [...pointsKey, 'epochs'],
    queryFn: ({ signal }) => fetchPointsEpochs(signal),
    select: data => data.epochs,
    staleTime: STALE_MS,
    retry,
  });
}

/** One page of a leaderboard, with `wallet`'s place on it. Keeps the last page while the next loads. */
export function usePointsLeaderboard(params: {
  campaign?: string;
  wallet?: string;
  limit: number;
  offset: number;
}) {
  return useQuery({
    queryKey: [...pointsKey, 'leaderboard', params],
    queryFn: ({ signal }) => fetchPointsLeaderboard(params, signal),
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
    retry,
  });
}

export function usePointsAccount(wallet: string | undefined) {
  return useQuery({
    queryKey: [...pointsKey, 'account', wallet],
    queryFn: ({ signal }) => fetchPointsAccount(wallet!, signal),
    enabled: !!wallet,
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
    retry,
  });
}

export function usePointsAccountEpochs(wallet: string | undefined) {
  return useQuery({
    queryKey: [...pointsKey, 'account-epochs', wallet],
    queryFn: ({ signal }) => fetchPointsAccountEpochs(wallet!, signal),
    select: data => data.epochs,
    enabled: !!wallet,
    staleTime: STALE_MS,
    retry,
  });
}

export function usePointsActivity(wallet: string | undefined) {
  return useInfiniteQuery({
    queryKey: [...pointsKey, 'activity', wallet],
    queryFn: ({ pageParam, signal }) =>
      fetchPointsActivity(wallet!, { limit: ACTIVITY_PAGE, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => last.next_cursor ?? undefined,
    enabled: !!wallet,
    staleTime: STALE_MS,
    retry,
  });
}

/**
 * Claims the connected wallet's claimable points: all of them, or the entry
 * ids passed to `mutate`. The wallet signs the prepared claim, which the
 * gateway keeps as the claim proof. Uses its access session, or for a wallet
 * without access its points-only session, signing in first when there is none
 * or the server rejects it.
 */
export function useClaimPoints() {
  const { publicKey, signMessage } = useWallet();
  const [sessions, setSessions] = useAtom(accessSessionAtom);
  const [pointsSessions, setPointsSessions] = useAtom(pointsSessionAtom);
  const queryClient = useQueryClient();
  const wallet = publicKey?.toBase58();

  return useMutation({
    mutationFn: async (ids?: number[]) => {
      if (!wallet || !signMessage) throw new Error('wallet_not_connected');
      const signIn = async () => {
        const { scope, session } = await signInForPoints(wallet, signMessage);
        const set = scope === 'access' ? setSessions : setPointsSessions;
        set(prev => ({ ...prev, [wallet]: session }));
        return session.token;
      };
      const live = (s?: { expiresAt: number }) => !!s && s.expiresAt - 5 * 60 > Date.now() / 1000;
      const cached = live(sessions[wallet]) ? sessions[wallet] : pointsSessions[wallet];
      const fresh = live(cached);
      let token = fresh ? cached.token : await signIn();
      let prepared;
      try {
        prepared = await prepareClaim(token, ids);
      } catch (e) {
        if (!fresh || !axios.isAxiosError(e) || e.response?.status !== 401) throw e;
        // The cached token was revoked or rotated server-side: sign in again.
        clearSession(wallet);
        token = await signIn();
        prepared = await prepareClaim(token, ids);
      }
      if (!prepared.nonce || !prepared.message) {
        return { wallet, claimed: 0, points: 0, claim_id: null };
      }
      const signature = await signMessage(new TextEncoder().encode(prepared.message));
      const result = await claimPoints(token, {
        nonce: prepared.nonce,
        signature: bs58.encode(signature),
      });
      // The refetch below must not get the browser's cached pre-claim reads.
      skipReadCache();
      return result;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: pointsKey }),
  });
}
