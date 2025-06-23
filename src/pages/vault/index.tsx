/**
 * Vault page
 * Interface for interacting with the vault
 */
import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { ArrowRightCircleIcon, LockKeyhole, LockKeyholeOpen, PlusIcon } from 'lucide-react';

import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  Select,
  SelectValue,
} from '../../shared/ui/select';
import { Button } from '../../shared/ui/button';
import { NumberInput } from '../../shared/ui/number-input';

import { useVaultClient } from '../../features/vault-deposit';
import {
  checkOrCreateAssociatedTokenAccount,
  fetchTokenBalance,
} from '../../shared/lib/solana/helpers';
import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';
import { config } from '@/shared/config/constants';

const tokens = [
  {
    publicKey: new PublicKey('AumtjAJgsrqE62YwMJAWwiMRwjdNYZ8QE9cN2wB5B4nw'),
    name: 'USDC',
  },
  {
    publicKey: new PublicKey('3QciYfuPwwPmneZroFpHnzkjJYrHq2Axnr45kF3c3Hxd'),
    name: 'SOL',
  },
];

type VaultStrategy = {
  name: string;
  // description: string;
  tvl: number;
  apr: number;
  logo: string;
  link: string;
};

const strategies: VaultStrategy[] = [
  {
    name: 'Kamino Finance',
    tvl: 1000000,
    apr: 10,
    logo: 'https://avatars.githubusercontent.com/u/151163804?s=280&v=4',
    link: 'https://kamino.finance',
  },
  {
    name: 'Drift',
    tvl: 2000000,
    apr: 9,
    logo: 'https://pbs.twimg.com/profile_images/1884910583621042176/mdGXo6iq_400x400.png',
    link: 'https://drift.trade',
  },
  {
    name: 'Marginfi',
    tvl: 500000,
    apr: 12,
    logo: 'https://pbs.twimg.com/profile_images/1878915465398956032/CJY6t1KD_400x400.jpg',
    link: 'https://www.marginfi.com/',
  },
];

function VaultStrategyCard({ strategy }: { strategy: VaultStrategy }) {
  return (
    <a
      href={strategy.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block group glass-panel p-6 transition-shadow border hover:bg-gradient-to-t hover:from-white/40  duration-200"
    >
      <div className="flex items-start gap-4 justify-between">
        <div className="flex flex-1 gap-4">
          <img
            src={strategy.logo}
            alt={`${strategy.name} logo`}
            className="w-12 h-12 object-cover"
          />
          <div className=" w-full">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-xl text-neutral-900">{strategy.name}</h3>
              <div className="text-neutral-400 hover:text-neutral-600 group-hover:text-blue-600 group-hover:translate-x-1 transition-all group-hover:scale-105">
                <ArrowRightCircleIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="w-full flex  justify-between   mt-2">
              <div className="flex-1 p-1">
                <p className="text-xs text-neutral-600 font-medium">TVL</p>
                <p className="text-sm font-mono font-medium">${strategy.tvl.toLocaleString()}</p>
              </div>
              <div className="flex-1 p-1 text-right">
                <p className="text-xs text-neutral-600 font-medium">APR</p>
                <p className="text-sm font-mono font-medium text-emerald-600">{strategy.apr}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}

function VaultStrategyList() {
  return (
    <div className="mt-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-neutral-900">Available Strategies</h2>
        <p className="text-neutral-600 mt-1">Choose a strategy to optimize your yields</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {strategies.map(strategy => (
          <VaultStrategyCard key={strategy.name} strategy={strategy} />
        ))}
      </div>
    </div>
  );
}

function VaultPage() {
  const [selectedToken, setSelectedToken] = useState<{ publicKey: PublicKey; name: string }>(
    tokens[0]
  );
  const vaultClient = useVaultClient();
  const { publicKey } = useWallet();
  const [amountDeposited, setAmountDeposited] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [tvl, setTvl] = useState<number>(0);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  const depositTokens = async () => {
    if (!vaultClient) {
      throw new Error('VAULT_CLIENT_NOT_FOUND');
    }

    const amount = new BN(depositAmount).mul(new BN(10 ** 9));
    const ata = await checkOrCreateAssociatedTokenAccount(
      vaultClient.provider,
      new PublicKey(selectedToken.publicKey),
      vaultClient.walletPk
    );

    await vaultClient.deposit(
      amount,
      new PublicKey(selectedToken.publicKey),
      ata,
      vaultClient.walletPk
    );

    setDepositAmount(0);
    getData();
  };

  const withdrawTokens = async () => {
    if (!vaultClient) {
      throw new Error('VAULT_CLIENT_NOT_FOUND');
    }

    const amount = new BN(withdrawAmount).mul(new BN(10 ** 9));
    const ata = await checkOrCreateAssociatedTokenAccount(
      vaultClient.provider,
      new PublicKey(selectedToken.publicKey),
      vaultClient.walletPk
    );

    await vaultClient.withdraw(
      amount,
      new PublicKey(selectedToken.publicKey),
      ata,
      vaultClient.walletPk
    );

    setWithdrawAmount(0);

    getData();
  };

  const handleAirdrop = async () => {
    if (!vaultClient) {
      throw new Error('VAULT_CLIENT_NOT_FOUND');
    }

    const selectedTokenMint = new PublicKey(selectedToken.publicKey);

    const ata = await checkOrCreateAssociatedTokenAccount(
      vaultClient.provider,
      selectedTokenMint,
      vaultClient.walletPk
    );

    try {
      const response = await axios.post(`${config.devnet.graphApiUrl}/dev/airdrop`, {
        mint: selectedTokenMint.toBase58(),
        recipient: ata.toBase58(),
        amount: 1000000000000,
      });

      if (response.data.signature) {
        toast.success('Tokens airdropped successfully!');
        getData();
      }
    } catch (error) {
      console.error('Failed to airdrop tokens:', error);
      const axiosError = error as AxiosError<{ error: string }>;
      toast.error(axiosError.response?.data?.error || 'Failed to airdrop tokens');
    }
  };

  const getData = useCallback(async () => {
    try {
      if (!vaultClient) {
        return;
      }

      setDepositAmount(0);
      setWithdrawAmount(0);
      setTvl(0);
      setWalletBalance(0);
      setAmountDeposited(0);

      const tokenMint = new PublicKey(selectedToken.publicKey);
      const [vaultStatePda] = await vaultClient.getVaultStatePDA(tokenMint);

      vaultClient.getVaultTokenAccount(vaultStatePda).then(vaultTokenAccount => {
        const tvl = Number(vaultTokenAccount.amount) / 10 ** 9;
        setTvl(tvl);
      });

      await fetchTokenBalance(
        vaultClient.walletPk,
        tokenMint,
        vaultClient.provider.connection
      ).then(balance => setWalletBalance(new BN(balance).div(new BN(10 ** 9)).toNumber()));

      await vaultClient?.getUserState(vaultClient.walletPk, vaultStatePda).then(userState => {
        const userDeposit = new BN(userState?.amountDeposited).div(new BN(10 ** 9));
        setAmountDeposited(userDeposit.toNumber());
      });
    } catch (error) {
      console.error(error);
    }
  }, [selectedToken, vaultClient]);

  useEffect(() => {
    getData();
  }, [getData]);

  return (
    <div className="flex flex-col gap-4">
      <div className="">
        <div className="container px-5  max-w-screen-lg mx-auto py-10 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <h1 className="text-4xl font-semibold ">{selectedToken.name} Vault</h1>
            <div className="flex-1 flex justify-end items-center gap-2">
              {publicKey && (
                <Button onClick={handleAirdrop} variant="outline" className="bg-secondary/50 ">
                  <PlusIcon className="w-4 h-4" />
                  Airdrop {selectedToken.name} tokens
                </Button>
              )}
              <Select
                defaultValue={selectedToken.publicKey.toBase58()}
                onValueChange={value => {
                  setSelectedToken(
                    tokens.find(token => token.publicKey.toBase58() === value) ?? tokens[0]
                  );
                }}
              >
                <SelectTrigger className="glass-panel w-40">
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent>
                  {tokens.map(token => (
                    <SelectItem key={token.publicKey.toBase58()} value={token.publicKey.toBase58()}>
                      {token.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {publicKey ? (
            <>
              <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4 glass-panel border">
                {/* Left Panel */}
                <div className="flex flex-col justify-between">
                  <div className="flex flex-col p-5 ">
                    <span className="text-sm text-neutral-600 font-medium">Vault TVL</span>
                    <div className="text-3xl tabular-nums font-mono font-semibold">
                      {tvl}
                      <span className="text-base pl-1 text-neutral-600 font-medium">
                        {selectedToken?.name}
                      </span>
                    </div>
                  </div>
                  <hr />
                  <div className="flex flex-col p-5">
                    <span className="text-sm text-neutral-600 font-medium">
                      Your Deposited Amount
                    </span>
                    <div className="text-3xl tabular-nums font-mono font-semibold">
                      {amountDeposited}
                      <span className="text-base pl-1 text-neutral-600 font-medium">
                        {selectedToken?.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Panel */}
                <div className="flex flex-col p-5">
                  <div className="flex italic items-center gap-2.5 mb-2.5">
                    <span className="font-medium">Wallet Balance</span>
                    <hr className="flex-1 border-primary/25" />
                    <span className="tabular-nums font-mono font-semibold">
                      {`${walletBalance} ${selectedToken?.name}`}
                    </span>
                  </div>
                  <div className="flex items-end gap-2.5">
                    <NumberInput
                      className="flex-1"
                      id="depositAmount"
                      name="depositAmount"
                      label="Deposit Amount"
                      unit={selectedToken?.name}
                      value={depositAmount.toString()}
                      onValueChange={values => setDepositAmount(values.floatValue ?? 0)}
                    />
                    <Button
                      className="w-36"
                      onClick={depositTokens}
                      disabled={depositAmount === 0 || depositAmount > walletBalance}
                    >
                      Deposit
                      <LockKeyhole className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-end gap-2.5">
                    <NumberInput
                      className="flex-1"
                      id="withdrawAmount"
                      name="withdrawAmount"
                      label="Withdraw Amount"
                      unit={selectedToken?.name}
                      value={withdrawAmount.toString()}
                      onValueChange={values => setWithdrawAmount(values.floatValue ?? 0)}
                    />
                    <Button
                      className="w-36"
                      variant="secondary"
                      onClick={withdrawTokens}
                      disabled={withdrawAmount === 0 || withdrawAmount > amountDeposited}
                    >
                      Withdraw
                      <LockKeyholeOpen className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <VaultStrategyList />
            </>
          ) : (
            <div className="flex p-4 glass-panel border">
              <p>Wallet not connected</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VaultPage;
