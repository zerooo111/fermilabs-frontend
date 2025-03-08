import { fermiClientAtom } from '@/atoms/fermiClient';
import { marketAccountAtom } from '@/atoms/market';
import { useAtomValue } from 'jotai';
import { useState } from 'react';
import Button from './ui/Button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/Popover';
import { SquareArrowOutUpRight } from 'lucide-react';
import Input from './ui/Input';
import { NumericFormat } from 'react-number-format';
import { Label } from './ui/Label';

const airdropUrl = 'http://localhost:3001/';

type TokenType = 'base' | 'quote';

const AirdropPopover = () => {
  const marketAccount = useAtomValue(marketAccountAtom);
  const client = useAtomValue(fermiClientAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenType>('base');
  const [amount, setAmount] = useState('10');
  const [isOpen, setIsOpen] = useState(false);

  const handleAirdrop = async () => {
    if (!client || !marketAccount) return;
    setIsLoading(true);

    try {
      const tokenMintAddress =
        selectedToken === 'base'
          ? marketAccount.baseMint.toBase58()
          : marketAccount.quoteMint.toBase58();

      const decimals =
        selectedToken === 'base' ? marketAccount.baseDecimals : marketAccount.quoteDecimals;

      const response = await fetch(airdropUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          destinationAddress: client.walletPk.toString(),
          tokenMintAddress,
          amount: Number(amount) * decimals,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Response from airdrop api', data);
      setIsOpen(false);
    } catch (error) {
      console.error('FAILED TO SEND AIRDROP', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">Get test tokens</Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <h6 className="font-bold leading-none">Request Test Tokens </h6>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={selectedToken === 'base' ? 'default' : 'outline'}
              onClick={() => setSelectedToken('base')}
              className="w-full"
            >
              Base Token
            </Button>
            <Button
              variant={selectedToken === 'quote' ? 'default' : 'outline'}
              onClick={() => setSelectedToken('quote')}
              className="w-full"
            >
              Quote Token
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="amount">Amount</Label>
            <NumericFormat
              id="amount"
              name="amount"
              customInput={Input}
              onValueChange={values => setAmount(values.value)}
              min={0}
              placeholder="Enter amount"
              required
              allowedDecimalSeparators={['.']}
              thousandSeparator=","
              allowNegative={false}
            />
          </div>
          <div className="text-xs font-medium flex flex-col ">
            <span className="uppercase font-bold">Token Mint Address</span>
            <a
              className="hover:underline hover:text-blue-500 text-zinc-500 flex items-center gap-1"
              href={`https://solscan.io/token/${
                selectedToken === 'base'
                  ? marketAccount?.baseMint.toBase58()
                  : marketAccount?.quoteMint.toBase58()
              }`}
            >
              {selectedToken === 'base'
                ? marketAccount?.baseMint.toBase58()
                : marketAccount?.quoteMint.toBase58()}

              <SquareArrowOutUpRight className="w-3 h-3" />
            </a>
          </div>
          <Button onClick={handleAirdrop} loading={isLoading} disabled={isLoading}>
            {isLoading ? 'Requesting Airdrop...' : 'Request Airdrop'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AirdropPopover;
