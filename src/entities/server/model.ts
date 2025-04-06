/**
 * Server entity model
 * Defines server-related state and operations
 */
import { atom, useAtom } from 'jotai';
import { Server } from '@/types';

export const servers: Server[] = [
  {
    label: 'Asia | Mumbai',
    url: 'http://13.203.79.139:8084',
    latency: null,
  },
  {
    label: 'EU | London',
    url: 'http://13.40.62.197:8084',
    latency: null,
  },
  {
    label: 'US | East',
    url: 'http://54.196.30.137:8084',
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
