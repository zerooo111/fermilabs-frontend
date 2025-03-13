import * as spl from '@solana/spl-token';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

import * as anchor from '@coral-xyz/anchor';
import { BN } from '@coral-xyz/anchor';

export function bpsToDecimal(bps: number): number {
  return bps / 10000;
}

export function percentageToDecimal(percentage: number): number {
  return percentage / 100;
}

export function shortenAddress(s: string) {
  return s.slice(0, 6) + '...' + s.slice(-6);
}

export function toNative(uiAmount: number, decimals: number): BN {
  return new BN((uiAmount * Math.pow(10, decimals)).toFixed(0));
}

export function toUiDecimals(nativeAmount: number, decimals: number): number {
  return nativeAmount / Math.pow(10, decimals);
}

export const QUOTE_DECIMALS = 6;

export function toUiDecimalsForQuote(nativeAmount: number): number {
  return toUiDecimals(nativeAmount, QUOTE_DECIMALS);
}

/**
 * Get the address of the associated token account for a given mint and owner
 *
 * @param mint                     Token mint account
 * @param owner                    Owner of the new account
 * @param allowOwnerOffCurve       Allow the owner account to be a PDA (Program Derived Address)
 * @param programId                SPL Token program account
 * @param associatedTokenProgramId SPL Associated Token program account
 *
 * @return Address of the associated token account
 */
export async function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve = true,
  programId = TOKEN_PROGRAM_ID,
  associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  if (!allowOwnerOffCurve && !PublicKey.isOnCurve(owner.toBuffer()))
    throw new Error('TokenOwnerOffCurve!');

  const [address] = await PublicKey.findProgramAddress(
    [owner.toBuffer(), programId.toBuffer(), mint.toBuffer()],
    associatedTokenProgramId
  );

  return address;
}

export async function createAssociatedTokenAccountIdempotentInstruction(
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): Promise<TransactionInstruction> {
  const account = await getAssociatedTokenAddress(mint, owner);
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.from([0x1]),
  });
}

export const createMint = async (
  provider: anchor.AnchorProvider,
  decimal: number
): Promise<{ signature: string; mintAddress: PublicKey }> => {
  try {
    // Token Mints are accounts which hold data ABOUT a specific token
    // Token Mints DO NOT hold tokens themselves
    const tokenMint = Keypair.generate();

    // amount of SOL required fro the account to not be deallocated
    const lamports = await spl.getMinimumBalanceForRentExemptMint(provider.connection);

    // `spl.createMint` function creates a transaction with the following two instruction: `createAccount` and `createInitializeMintInstruction`.
    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: tokenMint.publicKey,
        space: spl.MINT_SIZE,
        lamports,
        programId: spl.TOKEN_PROGRAM_ID,
      }),
      spl.createInitializeMintInstruction(
        tokenMint.publicKey,
        decimal,
        provider.wallet.publicKey,
        null,
        spl.TOKEN_PROGRAM_ID
      )
    );

    // prompts user to sign the transaction and submit it to the network
    const signature = await provider.sendAndConfirm(transaction, [tokenMint]);
    return { signature, mintAddress: tokenMint.publicKey };
  } catch (err) {
    console.error(err);
    throw err;
  }
};

export const checkOrCreateAssociatedTokenAccount = async (
  provider: anchor.AnchorProvider,
  mint: anchor.web3.PublicKey,
  owner: anchor.web3.PublicKey
): Promise<PublicKey> => {
  // Find the ATA for the given mint and owner
  const ata = await spl.getAssociatedTokenAddress(mint, owner, true);

  // Check if the ATA already exists
  const accountInfo = await provider.connection.getAccountInfo(ata);
  if (accountInfo == null) {
    // ATA does not exist, create it
    console.log('Creating Associated Token Account for user...');
    await createAssociatedTokenAccount(provider, mint, ata, owner);
    console.log('Associated Token Account created successfully.');
  } else {
    // ATA already exists
    console.log('Associated Token Account already exists.');
  }

  return ata;
};

export async function checkMintOfATA(
  connection: Connection,
  ataAddress: anchor.Address
): Promise<string> {
  try {
    const ataInfo = await connection.getAccountInfo(new PublicKey(ataAddress));
    if (ataInfo === null) {
      throw new Error('Account not found');
    }

    // The mint address is the first 32 bytes of the account data
    const mintAddress = new PublicKey(ataInfo.data.slice(0, 32));
    return mintAddress.toBase58();
  } catch (error) {
    console.error('Error in checkMintOfATA:', error);
    throw error;
  }
}

export const createAssociatedTokenAccount = async (
  provider: anchor.AnchorProvider,
  mint: anchor.web3.PublicKey,
  ata: anchor.web3.PublicKey,
  owner: anchor.web3.PublicKey
): Promise<void> => {
  const tx = new anchor.web3.Transaction();
  tx.add(spl.createAssociatedTokenAccountInstruction(provider.wallet.publicKey, ata, owner, mint));

  await provider.sendAndConfirm(tx, []);
};

export const mintTo = async (
  provider: anchor.AnchorProvider,
  mint: anchor.web3.PublicKey,
  ata: anchor.web3.PublicKey,
  amount: bigint
): Promise<string> => {
  const tx = new anchor.web3.Transaction();
  tx.add(spl.createMintToInstruction(mint, ata, provider.wallet.publicKey, amount, []));
  const signature = await provider.sendAndConfirm(tx, []);
  return signature;
};

export const fetchTokenBalance = async (
  userPubKey: PublicKey,
  mintPubKey: PublicKey,
  connection: Connection
) => {
  try {
    const associatedTokenAddress = await spl.getAssociatedTokenAddress(
      mintPubKey,
      userPubKey,
      false
    );
    const account = await spl.getAccount(connection, associatedTokenAddress);
    return account?.amount.toString();
  } catch (error) {
    console.error('Error in fetchTokenBalance:', error);
    return '0';
  }
};
