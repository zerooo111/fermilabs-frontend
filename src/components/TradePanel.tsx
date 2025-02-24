import React, { useState } from 'react';
import { TabsTrigger, Tabs, TabsList, TabsContent } from './ui/Tabs';
import { Label } from './ui/Label';
import { NumericFormat } from 'react-number-format';
import Input from './ui/Input';
import Button from './ui/Button';
import { BN } from '@coral-xyz/anchor';
import { useAtomValue } from 'jotai';
import { fermiClientAtom } from '@/atoms/fermiClient';
import MarketSelector from './MarketSelector';
import axios from 'axios';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';

type TradeFormState = {
  price: string;
  quantity: string;
  orderType: 'limit' | 'market';
};

const TradePanel = () => {
  const client = useAtomValue(fermiClientAtom);
  const [isProcessing, setIsProcessing] = useState(false);
  const { signMessage } = useWallet();

  const [formState, setFormState] = useState<TradeFormState>({
    price: '',
    quantity: '',
    orderType: 'limit',
  });

  const placeSignedOrderIntent = async (orderSide: 'Buy' | 'Sell', formValues: TradeFormState) => {
    if (!client || !signMessage) return;
    try {
      setIsProcessing(true);

      // Build the order intent json
      const orderIntent = {
        price: Number(formValues.price),
        quantity: Number(formValues.quantity),
        order_id: Date.now() + Number(formValues.price),
        side: orderSide,
        owner: client.walletPk.toBase58(),
        expiry: Math.floor(Date.now() / 1000) + 60 * 60,
      };

      // Build the message to be signed
      const orderMessage = new TextEncoder().encode(JSON.stringify(orderIntent, null, 2));
      // Add the prefix to the message
      const prefix = new TextEncoder().encode('FRM_DEX_ORDER:');
      const fullMessage = new Uint8Array(prefix.length + orderMessage.length);

      fullMessage.set(prefix);
      fullMessage.set(orderMessage, prefix.length);

      // Sign the message
      const signatureBytes = await signMessage(fullMessage);
      const hexSignature = Buffer.from(signatureBytes).toString('hex');

      // Send signed message to sequencer
      const body = {
        intent: orderIntent,
        signature: hexSignature,
      };

      const response = await axios.post('http://54.80.177.213:8080/place_order', body);
      console.log({ response });

      // Toast and reset form state
      toast.success(`${orderSide} order placed successfully`);
      setFormState({
        price: '',
        quantity: '',
        orderType: 'limit',
      });
    } catch (error) {
      console.error('Error placing signed order intent:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
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
                value={formState.price.toString()}
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
                value={formState.quantity.toString()}
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
              {/* <SignedOrderIntent /> */}
              <Button
                disabled={isProcessing || !formState.price || !formState.quantity || !signMessage}
                onClick={() => placeSignedOrderIntent('Buy', formState)}
                variant={'success'}
                className="w-full"
              >
                Buy
              </Button>
              <Button
                disabled={isProcessing || !formState.price || !formState.quantity || !signMessage}
                onClick={() => placeSignedOrderIntent('Sell', formState)}
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
