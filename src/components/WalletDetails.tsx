/**
 * WalletDetails.tsx
 * Displays connected wallet's SOL balance and address
 * Uses Solana web3.js for balance fetching
 */

import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export function WalletDetails() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchBalance = async () => {
      if (!publicKey) return;

      try {
        const balance = await connection.getBalance(publicKey);
        if (isMounted) {
          setBalance(balance / LAMPORTS_PER_SOL);
        }
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    };

    fetchBalance();
    // Set up balance refresh interval
    const intervalId = setInterval(fetchBalance, 10000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [connection, publicKey]);

  if (!publicKey) return null;

  return (
    <div className="flex flex-col gap-2 bg-gray-800 rounded-lg p-4 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-gray-400">Address:</span>
        <span className="font-mono">
          {`${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-400">Balance:</span>
        <span>{balance !== null ? `${balance.toFixed(4)} SOL` : 'Loading...'}</span>
      </div>
    </div>
  );
}
