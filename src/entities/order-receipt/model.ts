import { atom } from 'jotai';

// Solana explorer URL constants
const SOLANA_EXPLORER_URL = {
  mainnet: 'https://explorer.solana.com',
  devnet: 'https://explorer.solana.com/?cluster=devnet',
  testnet: 'https://explorer.solana.com/?cluster=testnet',
} as const;

export const getSolanaExplorerUrl = (signature: string): string => {
  const baseUrl = SOLANA_EXPLORER_URL.devnet;
  return `${baseUrl}/tx/${signature}`;
};

export interface OrderReceipt {
  orderId: number;
  timestamp: number;
  status: string;
  signature?: string;
  txHash?: string;
  sequenceNumber?: string;
  expectedTick?: string;
  explorerUrl?: string; // New field for the explorer URL
}

// Helper function to serialize/deserialize Map for localStorage
const serializeMap = (map: Map<number, OrderReceipt>): string => {
  return JSON.stringify(Array.from(map.entries()));
};

const deserializeMap = (str: string | null): Map<number, OrderReceipt> => {
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
      localStorage.setItem(key, serializeMap(update as Map<number, OrderReceipt>));
    }
  );

  return derivedAtom;
};

// Map of orderId to receipt with persistence
export const orderReceiptsAtom = createAtomWithLocalStorage<Map<number, OrderReceipt>>(
  'order-receipts',
  new Map()
);

// Atom to handle adding receipts
export const addOrderReceiptAtom = atom(null, (get, set, receipt: OrderReceipt) => {
  const receipts = get(orderReceiptsAtom);
  const newReceipts = new Map(receipts);

  // Generate explorer URL if signature exists
  if (receipt.signature) {
    receipt.explorerUrl = getSolanaExplorerUrl(receipt.signature);
  }

  newReceipts.set(receipt.orderId, receipt);
  set(orderReceiptsAtom, newReceipts);
});
