import { PublicKey } from '@solana/web3.js';

import { FermiClient } from '../fermiClient';

// Types
type OpenOrdersAccount = any; // Replace with actual type from your Fermi client

/**
 * Finds open orders accounts for a given market and owner
 * @param client - FermiClient instance
 * @param ownerPk - Public key of the account owner
 * @param marketPk - Public key of the market
 * @returns Promise containing array of open orders public keys
 */
export const findOpenOrdersAccounts = async (
  client: FermiClient,
  ownerPk: PublicKey,
  marketPk: PublicKey
): Promise<PublicKey[]> => {
  return client.findOpenOrdersForMarket(ownerPk, marketPk);
};

/**
 * Creates instructions for a new open orders account
 * @param client - FermiClient instance
 * @param marketPk - Public key of the market
 * @param accountName - Name for the new account
 * @param ownerPk - Public key of the account owner
 * @returns Promise containing instructions and account public key
 */
export const createOpenOrdersAccountIx = async (
  client: FermiClient,
  marketPk: PublicKey,
  accountName: string,
  ownerPk: PublicKey
): Promise<[any[], PublicKey]> => {
  return client.createOpenOrdersIx(marketPk, accountName, ownerPk, null);
};

/**
 * Deserializes an open orders account
 * @param client - FermiClient instance
 * @param accountPk - Public key of the account to deserialize
 * @returns Promise containing the deserialized account data
 */
export const deserializeOpenOrders = async (
  client: FermiClient,
  accountPk: PublicKey
): Promise<OpenOrdersAccount | null> => {
  return client.deserializeOpenOrderAccount(accountPk);
};

/**
 * Validates if an open orders account exists
 * @param openOrdersAccounts - Array of open orders accounts
 * @throws Error if account already exists
 */
export const validateNoExistingAccounts = (openOrdersAccounts: PublicKey[]) => {
  if (openOrdersAccounts.length > 0) {
    throw new Error('Open orders account already exists for this wallet and market');
  }
};
