/**
 * Server entity model
 * Defines server-related state and operations
 */
import { atom, useAtom } from 'jotai';
import { Server } from '@/types';

export interface ServerConfigMarket {
  market_index: number;
  name: string;
  execution_queue: {
    address: string;
    capacity?: number;
  };
}

export interface ServerConfig {
  version: number;
  mode: string;
  cluster: string;
  program_id: string;
  group: string;
  ctm_signer: string;
  markets: ServerConfigMarket[];
}

export const serverConfigAtom = atom<ServerConfig | null>(null);

export const servers: Server[] = [
  {
    label: 'Local Harness',
    url: 'http://127.0.0.1:9091',
    latency: null,
  },
];

// Default to the first server
export const selectedServerAtom = atom<Server>(servers[0]);

// Server hooks
export const useSelectedServer = () => {
  const [selectedServer, setSelectedServer] = useAtom(selectedServerAtom);

  return {
    selectedServer,
    setSelectedServer,
    servers,
  };
};
