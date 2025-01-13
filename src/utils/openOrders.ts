import { PublicKey } from '@solana/web3.js';
import { FermiClient } from '@/solana/fermiClient';

/**
 * Interface for open orders account creation result
 */
export interface OpenOrdersResult {
  account: any;
  publicKey: PublicKey;
}

/**
 * Creates a new open orders account for the given market and owner
 * @param client - FermiClient instance
 * @param marketPk - Market public key
 * @param accountName - Name for the new account
 * @param owner - Owner's public key
 * @returns Promise resolving to account data and public key
 */
export const createOpenOrdersAccount = async (
  client: FermiClient,
  marketPk: PublicKey,
  accountName: string,
  owner: PublicKey
): Promise<OpenOrdersResult> => {
  // Check for existing accounts
  const openOrdersAccounts = await client.findOpenOrdersForMarket(owner, marketPk);

  if (openOrdersAccounts.length > 0) {
    throw new Error('Open orders account already exists for this wallet and market');
  }

  // Create new account
  const [instructions, accountPk] = await client.createOpenOrdersIx(
    marketPk,
    accountName,
    owner,
    null
  );

  await client.sendAndConfirmTransaction(instructions, {});

  // Load the new account
  const accountData = await client.deserializeOpenOrderAccount(accountPk);

  if (!accountData) {
    throw new Error('Failed to deserialize new open orders account');
  }

  return { account: accountData, publicKey: accountPk };
};

/**
 * Loads existing open orders accounts for the given market and owner
 * @param client - FermiClient instance
 * @param marketPk - Market public key
 * @param owner - Owner's public key
 * @returns Promise resolving to account data and public key
 */
export const loadOpenOrdersAccount = async (
  client: FermiClient,
  marketPk: PublicKey,
  owner: PublicKey
): Promise<OpenOrdersResult | null> => {
  const openOrdersAccounts = await client.findOpenOrdersForMarket(owner, marketPk);

  if (!openOrdersAccounts.length) {
    return null;
  }

  const accountData = await client.deserializeOpenOrderAccount(openOrdersAccounts[0]);

  if (!accountData) {
    throw new Error('Failed to deserialize open orders account');
  }

  return { account: accountData, publicKey: openOrdersAccounts[0] };
};

/**
 * Refreshes an existing open orders account
 * @param client - FermiClient instance
 * @param accountPk - Account public key to refresh
 * @returns Promise resolving to updated account data and public key
 */
export const refreshOpenOrdersAccount = async (
  client: FermiClient,
  accountPk: PublicKey
): Promise<OpenOrdersResult> => {
  const accountData = await client.deserializeOpenOrderAccount(accountPk);

  if (!accountData) {
    throw new Error('Failed to deserialize open orders account');
  }

  return { account: accountData, publicKey: accountPk };
};
