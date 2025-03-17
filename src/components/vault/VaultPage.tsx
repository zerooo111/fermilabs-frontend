import { baseMint, quoteMint } from '@/solana/constants';
import { SelectContent, SelectItem, SelectTrigger, Select, SelectValue } from '../ui/select';
import { useVaultClient } from './useVaultProgram';
import { useCallback, useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '../ui/button';
import { checkOrCreateAssociatedTokenAccount, fetchTokenBalance } from '@/solana/utils/helpers';
import { BN } from '@coral-xyz/anchor';
import { NumberInput } from '../ui/number-input';
import { LockKeyhole, LockKeyholeOpen } from 'lucide-react';

const tokens = [
  {
    publicKey: baseMint,
    name: 'USDC',
  },
  {
    publicKey: quoteMint,
    name: 'SOL',
  },
];

export default function VaultPage() {
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
      <div className="bg-neutral-100 p-3">
        <div className="container max-w-screen-lg mx-auto py-10 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-semibold">{selectedToken.name} Vault</h1>
            <div>
              <Select
                defaultValue={selectedToken.publicKey.toBase58()}
                onValueChange={value => {
                  setSelectedToken(
                    tokens.find(token => token.publicKey.toBase58() === value) ?? tokens[0]
                  );
                }}
              >
                <SelectTrigger className="bg-white">
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
            <div className="grid grid-cols-2 max-md:grid-cols-1 divide-x divide-y gap-4 bg-white rounded-lg border">
              {/* Left Panel */}
              <div className="flex flex-col justify-between">
                <div className="flex flex-col p-5">
                  <span className="text-sm text-neutral-500 font-medium">Vault TVL</span>
                  <div className="text-3xl tabular-nums font-mono font-semibold">
                    {tvl}
                    <span className="text-base pl-1 text-neutral-500 font-medium">
                      {selectedToken?.name}
                    </span>
                  </div>
                </div>
                <hr />
                <div className="flex flex-col p-5">
                  <span className="text-sm text-neutral-500 font-medium">
                    Your Deposited Amount
                  </span>
                  <div className="text-3xl tabular-nums font-mono font-semibold">
                    {amountDeposited}
                    <span className="text-base pl-1 text-neutral-500 font-medium">
                      {selectedToken?.name}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Panel */}
              <div className="flex flex-col p-5">
                <div className="flex italic items-center gap-2.5 mb-2.5">
                  <span className="font-medium">Wallet Balance</span>
                  <hr className="flex-1" />
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
                    onClick={withdrawTokens}
                    disabled={withdrawAmount === 0 || withdrawAmount > amountDeposited}
                  >
                    Withdraw
                    <LockKeyholeOpen className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex p-4 bg-white rounded-lg border">
              <p>Wallet not connected</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
