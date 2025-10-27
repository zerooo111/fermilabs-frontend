import { atom } from 'jotai';
import { API_ROUTES } from '@/shared/config/constants';

// FermiLabs explorer URL constants
const FERMILABS_EXPLORER_URL = 'https://explorer-staging.fermilabs.xyz';

export const getFermiLabsExplorerUrl = (path: string): string => {
  return `${FERMILABS_EXPLORER_URL}${path}`;
};

export const getTickExplorerUrl = (tickNumber: string): string => {
  return getFermiLabsExplorerUrl(`/tick/${tickNumber}`);
};

export const getTxExplorerUrl = (txHash: string): string => {
  return getFermiLabsExplorerUrl(`${API_ROUTES.tx}/${txHash}`);
};

export interface OrderReceipt {
  sequence_number: string;
  expected_tick: string;
  tx_hash: string;
  order_id?: number; // Add order_id to link back to the order
}

// Helper function to serialize/deserialize Map for localStorage
const serializeMap = (map: Map<string, OrderReceipt>): string => {
  return JSON.stringify(Array.from(map.entries()));
};

const deserializeMap = (str: string | null): Map<string, OrderReceipt> => {
  if (!str) return new Map();
  try {
    const entries = JSON.parse(str);
    return new Map(entries);
  } catch {
    return new Map();
  }
};

// Create atom with localStorage persistence
const createAtomWithLocalStorage = <T>(key: string, initialValue: T) => {
  const getInitialValue = () => {
    const item = localStorage.getItem(key);
    return item ? deserializeMap(item) : initialValue;
  };

  const baseAtom = atom(getInitialValue());

  const derivedAtom = atom(
    get => get(baseAtom),
    (get, set, update: T) => {
      set(baseAtom, update);
      localStorage.setItem(key, serializeMap(update as Map<string, OrderReceipt>));
    }
  );

  return derivedAtom;
};

// Map of sequence_number to receipt with persistence
export const orderReceiptsAtom = createAtomWithLocalStorage<Map<string, OrderReceipt>>(
  'order-receipts',
  new Map()
);

// Atom to handle adding receipts
export const addOrderReceiptAtom = atom(null, (get, set, receipt: OrderReceipt) => {
  const receipts = get(orderReceiptsAtom);
  const newReceipts = new Map(receipts);

  newReceipts.set(receipt.sequence_number, receipt);
  set(orderReceiptsAtom, newReceipts);
});
