import { useEffect } from 'react';
import { FermiClient } from '@/solana/fermiClient';
import { PublicKey } from '@solana/web3.js';
import { AnchorWallet, useAnchorWallet } from '@solana/wallet-adapter-react';
import { Connection } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';
import { config } from '@/solana/constants';
import { AnchorProvider } from '@coral-xyz/anchor';
import EmptyWallet from '@/solana/utils/emptyWallet';
import { fermiClientAtom } from '@/atoms/fermiClient';
import { useAtom } from 'jotai';

const getFermiClient = (wallet?: AnchorWallet) => {
  const connection = new Connection(config.devnet.rpcUrl);
  const provider = new AnchorProvider(
    connection,
    wallet ? wallet : new EmptyWallet(new Keypair()),
    AnchorProvider.defaultOptions()
  );
  return new FermiClient(provider, new PublicKey(config.devnet.programId));
};

/* This component is used to initialise the fermi client so that all the children always have client defined else the app would not be usable */
const FermiClientProvider = ({ children }: { children: React.ReactNode }) => {
  const [client, setClient] = useAtom(fermiClientAtom);

  const connectedWallet = useAnchorWallet();

  useEffect(() => {
    console.log('Building client with wallet', connectedWallet?.publicKey.toString());
    const client = getFermiClient(connectedWallet);
    setClient(client);
  }, [connectedWallet, setClient]);

  if (!client) {
    return <div className="min-h-screen grid place-items-center">Loading fermi client...</div>;
  }

  return <>{children}</>;
};

export default FermiClientProvider;
