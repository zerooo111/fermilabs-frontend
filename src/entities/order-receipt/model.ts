import { atom } from 'jotai';

export interface OrderReceipt {
  orderId: number;
  timestamp: number;
  status: string;
  signature?: string;
  txHash?: string;
}

// Map of orderId to receipt
export const orderReceiptsAtom = atom<Map<number, OrderReceipt>>(new Map());

// Atom to handle adding receipts
export const addOrderReceiptAtom = atom(null, (get, set, receipt: OrderReceipt) => {
  const receipts = get(orderReceiptsAtom);
  const newReceipts = new Map(receipts);
  newReceipts.set(receipt.orderId, receipt);
  set(orderReceiptsAtom, newReceipts);
});
