import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { fermiClientAtom } from '@/atoms/fermiClient';
import { marketAddressAtom } from '@/atoms/market';
import { useOpenOrdersAccount } from '@/hooks/useOpenOrdersAccount';
import Input from './ui/Input';
import Button from './ui/Button';
import { ChevronRight } from 'lucide-react';
import { PublicKey } from '@solana/web3.js';

export const CreateOpenOrdersAccountForm = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  const { refetch: refetchOpenOrdersAccount } = useOpenOrdersAccount();
  const client = useAtomValue(fermiClientAtom);
  const marketAddress = useAtomValue(marketAddressAtom);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsProcessing(true);

    if (!client) return;

    try {
      const formData = new FormData(e.target as HTMLFormElement);
      const accountName = (formData.get('accountName') as string).trim();

      if (accountName.length === 0) return;

      const [instructions, accountPk] = await client.createOpenOrdersIx(
        new PublicKey(marketAddress),
        accountName,
        client.walletPk,
        null
      );

      if (!instructions || !accountPk) return;

      await client.sendAndConfirmTransaction(instructions);

      await refetchOpenOrdersAccount();
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2 h-full ">
      <div className="max-w-m space-y-2">
        <p className="text-lg text-left text-gray-500 font-medium">
          You need to create an account to trade
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input name="accountName" required placeholder="Enter account name" />
          <Button type="submit" loading={isProcessing}>
            {isProcessing ? 'Processing...' : 'Create Account'}
            {!isProcessing && <ChevronRight />}
          </Button>
        </form>
      </div>
    </div>
  );
};
