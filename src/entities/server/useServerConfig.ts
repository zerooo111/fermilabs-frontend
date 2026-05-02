import { useQuery } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { useEffect } from 'react';
import axios from 'axios';
import { config } from '@/shared/config/constants';
import { serverConfigAtom, type ServerConfig } from './model';

export const SERVER_CONFIG_QUERY_KEY = ['server-config'] as const;

async function fetchServerConfig(): Promise<ServerConfig> {
  const res = await axios.get<ServerConfig>(`${config.devnet.gatewayUrl}/config`);
  return res.data;
}

export function useServerConfig() {
  const setServerConfig = useSetAtom(serverConfigAtom);

  const query = useQuery<ServerConfig>({
    queryKey: SERVER_CONFIG_QUERY_KEY,
    queryFn: fetchServerConfig,
    staleTime: 5 * 60 * 1000,
    retry: 3,
  });

  useEffect(() => {
    if (query.data) {
      setServerConfig(query.data);
    }
  }, [query.data, setServerConfig]);

  return query;
}
