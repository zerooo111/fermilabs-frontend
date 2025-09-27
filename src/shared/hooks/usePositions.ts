import { usePNL, Position } from './usePNL';

export type { Position };

export function usePositions(userPubKey: string) {
  const { data, ...queryResult } = usePNL(userPubKey);

  return {
    ...queryResult,
    data: data?.positions || [],
  };
}
