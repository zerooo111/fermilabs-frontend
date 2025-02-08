import React, { useState } from 'react';
import { TabsTrigger, Tabs, TabsList, TabsContent } from './ui/Tabs';
import { Label } from './ui/Label';
import { NumericFormat } from 'react-number-format';
import Input from './ui/Input';
import Button from './ui/Button';
import { BN } from '@coral-xyz/anchor';
import { MarketAccount } from '@/solana/fermiClient';
import { OrderType, SelfTradeBehavior, Side } from '@/solana/constants';
import { useOpenOrdersAccount } from '@/hooks/useOpenOrdersAccount';
import { PublicKey } from '@solana/web3.js';
import { checkOrCreateAssociatedTokenAccount } from '@/solana/utils/helpers';
import { useAtomValue } from 'jotai';
import { fermiClientAtom } from '@/atoms/fermiClient';
import MarketSelector from './MarketSelector';
// import { useWallet } from '@solana/wallet-adapter-react';

type TradeFormState = {
  price: string;
  quantity: string;
  orderType: 'limit' | 'market';
};

type Props = {
  marketAddress: string;
  marketAccount: MarketAccount;
};

const TradePanel = ({ marketAddress, marketAccount }: Props) => {
  const client = useAtomValue(fermiClientAtom);
  const [isProcessing, setIsProcessing] = useState(false);
  const { data: openOrdersData } = useOpenOrdersAccount();
  // const { signMessage, publicKey, signTransaction } = useWallet();

  const [formState, setFormState] = useState<TradeFormState>({
    price: '',
    quantity: '',
    orderType: 'limit',
  });

  const signOrderIntent = async () => {
    // try {
    //   const placeReponse = await fetch('http://localhost:8080/place_order', {
    //     method: 'POST',
    //     headers: {
    //       'Access-Control-Allow-Origin': '*',
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({ intent: oi, signature }),
    //   });
    //   if (!placeReponse.ok) {
    //     throw new Error('Failed to place order');
    //   }
    // } catch (error) {
    //   console.error('Error placing order:', error);
    //   throw error;
    // }
  };

  const placeLimitOrder = async (orderSide: 'buy' | 'sell', formValues: TradeFormState) => {
    if (!client) return;
    try {
      setIsProcessing(true);
      if (!openOrdersData) throw new Error('OpenOrders Account not found for this wallet');

      const side = orderSide === 'buy' ? Side.Bid : Side.Ask;
      // Build the order args
      const orderArgs = {
        side,
        priceLots: new BN(formValues.price),
        maxBaseLots: new BN(formState.quantity),
        maxQuoteLotsIncludingFees: new BN(formState.quantity).mul(new BN(formState.price)),
        clientOrderId: new BN((openOrdersData?.account.openOrders.length ?? 0) + 1),
        orderType: OrderType.Limit,
        expiryTimestamp: new BN(Math.floor(Date.now() / 1000) + 3600),
        selfTradeBehavior: SelfTradeBehavior.DecrementTake,
        limit: 5,
      };

      // Get appropriate token account based on order side
      const userTokenAccount = new PublicKey(
        await checkOrCreateAssociatedTokenAccount(
          client.provider,
          side === Side.Bid ? marketAccount.quoteMint : marketAccount.baseMint,
          client.walletPk
        )
      );

      await client.placeOrderIx(
        openOrdersData.publicKey,
        new PublicKey(marketAddress),
        marketAccount,
        userTokenAccount,
        null, // openOrdersAdmin
        orderArgs,
        [] // remainingAccounts
      );

      // Sign the transaction and log it to the console

      // await client.sendAndConfirmTransaction([ix], {
      // additionalSigners: signers,
      // });
    } catch (error) {
      console.error('Error placing limit order:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBuyLimit = () => {
    return placeLimitOrder('buy', formState);
  };

  const handleSellLimit = () => {
    return placeLimitOrder('sell', formState);
  };

  const handleOrderTypeChange = (value: string) => {
    setFormState(prev => ({ ...prev, orderType: value as 'limit' | 'market' }));
  };

  return (
    <div className="flex flex-col gap-2 p-4">
      {/* DropDown components for market select */}
      <MarketSelector />

      <h6 className="heading">Place Order</h6>
      <Tabs defaultValue={formState.orderType} onValueChange={handleOrderTypeChange}>
        <TabsList className="w-full">
          <TabsTrigger className="w-full" value="limit">
            Limit{' '}
          </TabsTrigger>
          <TabsTrigger disabled className="w-full" value="market">
            Market{' '}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="limit">
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="price">Price</Label>
              <NumericFormat
                id="price"
                name="price"
                customInput={Input}
                // value={formState.price.toString()}
                onValueChange={values => setFormState(prev => ({ ...prev, price: values.value }))}
                min={0}
                placeholder="Enter price"
                required
                allowedDecimalSeparators={['.']}
                thousandSeparator=","
                allowNegative={false}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="quantity">Quantity</Label>
              <NumericFormat
                id="quantity"
                name="quantity"
                customInput={Input}
                // value={formState.price.toString()}
                onValueChange={values =>
                  setFormState(prev => ({ ...prev, quantity: values.value }))
                }
                min={0}
                placeholder="Enter quantity"
                required
                allowedDecimalSeparators={['.']}
                thousandSeparator=","
                allowNegative={false}
              />
            </div>
            <div className="flex justify-between items-center gap-2 text-sm font-semibold">
              <span>TOTAL COST</span>
              <span className="h-[1px] flex-1 bg-zinc-300"></span>
              <span>
                {new BN(formState?.price ?? 0).mul(new BN(formState?.quantity ?? 0)).toString()}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={isProcessing}
                onClick={signOrderIntent}
                variant={'success'}
                className="w-full"
              >
                Sign Order Intent
              </Button>
              <Button
                disabled={isProcessing}
                onClick={handleBuyLimit}
                variant={'success'}
                className="w-full"
              >
                Buy
              </Button>
              <Button
                disabled={isProcessing}
                onClick={handleSellLimit}
                variant={'destructive'}
                className="w-full"
              >
                {' '}
                Sell
              </Button>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="market">Market Contet</TabsContent>
      </Tabs>
    </div>
  );
};

export default TradePanel;
