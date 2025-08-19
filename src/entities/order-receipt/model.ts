import { atom } from 'jotai';

// Solana explorer URL constants
const SOLANA_EXPLORER_URL = {
  mainnet: 'https://explorer.solana.com',
  devnet: 'https://explorer.solana.com/?cluster=devnet',
  testnet: 'https://explorer.solana.com/?cluster=testnet',
} as const;

export const getSolanaExplorerUrl = (txHash: string): string => {
  const baseUrl = SOLANA_EXPLORER_URL.devnet;
  return `${baseUrl}/tx/${txHash}`;
};

export interface OrderReceipt {
  sequence_number: string;
  expected_tick: string;
  tx_hash: string;
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
  } catch (e) {
    console.error('Error deserializing order receipts:', e);
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
