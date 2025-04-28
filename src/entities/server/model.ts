/**
 * Server entity model
 * Defines server-related state and operations
 */
import { atom, useAtom } from 'jotai';
import { Server } from '@/types';

export const servers: Server[] = [
  // {
  //   label: 'Asia | Mumbai',
  //   url: 'https://13.203.79.139:8084',
  //   latency: null,
  // },
  // {
  //   label: 'EU | London',
  //   url: 'http://13.40.62.197:8084',
  //   latency: null,
  // },
  // {
  //   label: 'US | Virgina',
  //   url: 'http://54.196.30.137:8084',
  //   latency: null,
  // },
  // {
  //   label: 'Asia | Tokyo',
  //   url: 'http://57.180.19.124:8084',
  //   latency: null,
  // },
  // {
  //   label: 'Asia | Singapore',
  //   url: 'http://13.212.90.103:8084',
  //   latency: null,
  // },
  {
    label: 'UAE | Dubai',
    url: 'https://api1.fermilabs.xyz',
    latency: null,
  },
  // {
  //   label: 'Asia | Tokyo',
  //   url: 'https://57.180.19.124:8080',
  //   latency: null,
  // },
  // {
  //   label: 'ME | Dubai',
  //   url: 'http://3.29.35.226:8080',
  //   latency: null,
  // },
  // {
  //   label: 'Asia | Singapore',
  //   url: 'http://13.212.90.103:8080',
  //   latency: null,
  // },
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
