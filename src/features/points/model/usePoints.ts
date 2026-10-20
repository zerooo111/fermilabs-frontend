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

import { accessSessionAtom, clearSession, signInSession } from '@/features/access-gate';
import {
  claimPoints,
  fetchPointsAccount,
  fetchPointsActivity,
  fetchPointsEpochs,
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
 * Claims the connected wallet's claimable points. Uses its access-gate session,
 * signing a new one first when there is none or the server rejects it, so one
 * click is enough. Fails with `AccessGateError('wallet_not_whitelisted')` for
 * wallets without Fermi access.
 */
export function useClaimPoints() {
  const { publicKey, signMessage } = useWallet();
  const [sessions, setSessions] = useAtom(accessSessionAtom);
  const queryClient = useQueryClient();
  const wallet = publicKey?.toBase58();

  return useMutation({
    mutationFn: async () => {
      if (!wallet || !signMessage) throw new Error('wallet_not_connected');
      const signIn = async () => {
        const session = await signInSession(wallet, signMessage);
        setSessions(prev => ({ ...prev, [wallet]: session }));
        return session.token;
      };
      const cached = sessions[wallet];
      const fresh = cached && cached.expiresAt - 5 * 60 > Date.now() / 1000;
      const token = fresh ? cached.token : await signIn();
      try {
        return await claimPoints(token);
      } catch (e) {
        if (!fresh || !axios.isAxiosError(e) || e.response?.status !== 401) throw e;
        // The cached token was revoked or rotated server-side: sign in again.
        clearSession(wallet);
        return claimPoints(await signIn());
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: pointsKey }),
  });
}
