import { Commitment, PublicKey } from '@solana/web3.js';

import { AnchorProvider } from '@coral-xyz/anchor';

import { config } from '../constants';
import { FermiClient } from '../fermiClient';

export default function initFermiClient(provider: AnchorProvider) {
  // This function is called whenever a transaction is sent to the network
  const postSendTxCallback = ({ txid }: { txid: string }) => {
    console.log(`[Tx] ${txid} sent`);
    console.log(`[Tx] Explorer: https://explorer.solana.com/tx/${txid}?cluster=devnet`);
  };

  const txConfirmationCommitment: Commitment = 'confirmed';

  const opts = {
    postSendTxCallback,
    txConfirmationCommitment,
  };

  const client = new FermiClient(provider, new PublicKey(config.devnet.programId), opts);
  return client;
}
