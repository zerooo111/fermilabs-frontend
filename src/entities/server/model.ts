/**
 * Server entity model
 * Defines server-related state and operations
 */
import { atom, useAtom } from 'jotai';
import { Server } from '@/types';

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
