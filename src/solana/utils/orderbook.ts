import { PublicKey } from '@solana/web3.js';

import { Order } from '@/types/jotai';

import { BookSideAccount, FermiClient } from '../fermiClient';
import { parseBookSideAccount } from '../parsers';

/**
 * Deserializes both sides of the orderbook
 * @param client - FermiClient instance
 * @param bidsAddress - Public key of bids account
 * @param asksAddress - Public key of asks account
 * @returns Promise containing both book side accounts
 */
export const deserializeOrderbook = async (
  client: FermiClient,
  bidsAddress: PublicKey,
  asksAddress: PublicKey
): Promise<[BookSideAccount | null, BookSideAccount | null]> => {
  return Promise.all([
    client.deserializeBookSide(bidsAddress),
    client.deserializeBookSide(asksAddress),
  ]);
};

/**
 * Parses raw orderbook accounts into sorted orders
 * @param client - FermiClient instance
 * @param bidsAccount - Raw bids account
 * @param asksAccount - Raw asks account
 * @returns Promise containing sorted bids and asks
 */
export const parseOrderbook = async (
  client: FermiClient,
  bidsAccount: BookSideAccount,
  asksAccount: BookSideAccount
): Promise<[Order[], Order[]]> => {
  const [parsedBids, parsedAsks] = await Promise.all([
    parseBookSideAccount(client, bidsAccount),
    parseBookSideAccount(client, asksAccount),
  ]);

  // Sort bids in descending order (highest price first)
  parsedBids.sort((a, b) => b.price - a.price);
  // Sort asks in ascending order (lowest price first)
  parsedAsks.sort((a, b) => a.price - b.price);

  return [parsedBids, parsedAsks];
};
