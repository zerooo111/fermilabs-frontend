import { getAssociatedTokenAddress } from '@solana/spl-token';
import { type Connection, type Keypair, type PublicKey } from '@solana/web3.js';

import * as anchor from '@coral-xyz/anchor';

import { createAssociatedTokenAccount, mintTo } from './helpers';

interface AirdropTokenParams {
  receiverPk: PublicKey;
  ownerKp: Keypair;
  connection: Connection;
  mint: PublicKey;
  amount: number;
}

export async function airdropToken({
  receiverPk,
  ownerKp,
  connection,
  mint,
  amount,
}: AirdropTokenParams): Promise<void> {
  try {
    const wallet = new anchor.Wallet(ownerKp);
    const provider = new anchor.AnchorProvider(
      connection,
      wallet,
      anchor.AnchorProvider.defaultOptions()
    );

    const receiverTokenAccount: PublicKey = await getAssociatedTokenAddress(
      new anchor.web3.PublicKey(mint),
      receiverPk,
      false
    );

    if ((await connection.getAccountInfo(receiverTokenAccount)) == null) {
      await createAssociatedTokenAccount(
        provider,
        new anchor.web3.PublicKey(mint),
        receiverTokenAccount,
        receiverPk
      );
    }

    await mintTo(
      provider,
      new anchor.web3.PublicKey(mint),
      receiverTokenAccount,
      BigInt(amount.toString())
    );
    // return receiverTokenAccount;
  } catch (err) {
    console.log('Something went wrong while airdropping coin token.');
    console.log(err);
  }
}
