import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { useState } from 'react';
import { OrderIntent } from '@/solana/OrderIntent';
import { createHash } from 'crypto';
import { BN } from '@coral-xyz/anchor';
import { ExternalLinkIcon } from 'lucide-react';
import { submitOrderToSequencer } from '@/lib/sequencer';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';
import { quoteMint } from '@/solana/constants';
import { baseMint } from '@/solana/constants';
import { NumberInput } from '../ui/number-input';

export default function TradePanel() {
  const [formState, setFormState] = useState({
    price: 0,
    size: 0,
    orderType: 'limit',
  });

  const { signMessage, publicKey } = useWallet();

  const placeOrderIntent = async (intent: OrderIntent) => {
    if (!signMessage) throw new Error('Wallet not connected!');

    const serializedData = OrderIntent.serialize(intent);
    const prefix = Buffer.from('FRM_DEX_ORDER');

    const encodedMessage = Buffer.concat([prefix, serializedData]);

    const sha256Hash = createHash('sha256').update(new Uint8Array(encodedMessage)).digest();

    const sha256Hash_hex = Buffer.from(sha256Hash).toString('hex');

    // Sign the message
    const signatureBytes = await signMessage(Buffer.from(sha256Hash_hex));

    const hexSignature = Buffer.from(signatureBytes).toString('hex');

    const body = {
      intent: {
        order_id: intent.order_id.toNumber(),
        owner: intent.owner.toBase58(),
        side: intent.side,
        price: intent.price.toNumber(),
        quantity: intent.quantity.toNumber(),
        expiry: intent.expiry.toNumber(),
        base_mint: intent.base_mint.toBase58(),
        quote_mint: intent.quote_mint.toBase58(),
      },
      signature: hexSignature,
    };

    const response = await submitOrderToSequencer(body);

    return response;
  };

  const placeSellOrder = async () => {
    try {
      if (!publicKey) throw new Error('Wallet not connected!');
      const orderId = new BN(Math.floor(Math.random() * 10000000));

      const intent = new OrderIntent(
        orderId,
        publicKey,
        'Sell',
        new BN(formState.price),
        new BN(formState.size),
        new BN(Date.now() + 60 * 60 * 1000),
        baseMint,
        quoteMint
      );

      const response = await placeOrderIntent(intent);
      console.log('Order placed', { response });
      toast.success('Sell Order placed');
    } catch (error) {
      console.error(error);
      toast.error('Failed to place order');
    }
  };

  const placeBuyOrder = async () => {
    try {
      if (!publicKey) throw new Error('Wallet not connected!');
      const orderId = new BN(Math.floor(Math.random() * 10000000));

      const intent = new OrderIntent(
        orderId,
        publicKey,
        'Buy',
        new BN(formState.price),
        new BN(formState.size),
        new BN(Date.now() + 60 * 60 * 1000),
        baseMint,
        quoteMint
      );
      const response = await placeOrderIntent(intent);
      console.log('Order placed', { response });
      toast.success('Buy Order placed');
    } catch (error) {
      console.error(error);
      toast.error('Failed to place order');
    }
  };

  return (
    <div className="flex flex-col border border-border rounded-lg w-xs overflow-hidden">
      <Tabs defaultValue="limit">
        <TabsList className="w-full rounded-none border-b">
          <TabsTrigger value="limit" className="flex-1">
            Limit
          </TabsTrigger>
          <TabsTrigger value="market" className="flex-1" disabled>
            Market
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-col p-3 gap-3 flex-1">
        <NumberInput
          id="price"
          name="price"
          label="Price"
          value={formState.price.toString()}
          onValueChange={values =>
            setFormState(prev => ({ ...prev, price: values.floatValue ?? 0 }))
          }
          min={0}
          placeholder="Enter price"
          required
          unit="QUOTE"
        />

        <NumberInput
          id="size"
          name="size"
          label="Size"
          value={formState.size.toString()}
          onValueChange={values =>
            setFormState(prev => ({ ...prev, size: values.floatValue ?? 0 }))
          }
          min={0}
          placeholder="Enter size"
          required
          unit="BASE"
        />

        <div className="grid grid-cols-2 gap-2 ">
          <Button
            variant="default"
            disabled={!formState.price || !formState.size}
            onClick={placeBuyOrder}
          >
            Buy
          </Button>
          <Button
            variant="default"
            disabled={!formState.price || !formState.size}
            onClick={placeSellOrder}
          >
            Sell
          </Button>
        </div>
        <div className="bg-gray-100 font-medium rounded-sm p-2 text-xs space-y-1 mt-auto">
          <div className="flex items-center justify-between">
            <span>Order Value</span>
            <span className="tabular-nums">
              {(Number(formState.price) * Number(formState.size)).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Fees</span>
            <span className="tabular-nums">0.01%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-nowrap">Base Token</span>
            <a
              href={`https://solscan.io/token/${baseMint.toBase58()}`}
              className="group tabular-nums inline-flex items-center gap-1 font-normal text-neutral-600 hover:text-blue-600 transition-colors"
              target="_blank"
              title={baseMint.toBase58()}
            >
              {`${baseMint.toBase58().slice(0, 8)}...${baseMint.toBase58().slice(-8)}`}
              <ExternalLinkIcon className="size-0 group-hover:size-3 transition-all" />
            </a>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-nowrap">Quote Token</span>
            <a
              href={`https://solscan.io/token/${quoteMint.toBase58()}`}
              className="group tabular-nums inline-flex items-center gap-1 font-normal text-neutral-600 hover:text-blue-600 transition-colors"
              target="_blank"
              title={quoteMint.toBase58()}
            >
              {`${quoteMint.toBase58().slice(0, 8)}...${quoteMint.toBase58().slice(-8)}`}
              <ExternalLinkIcon className="size-0 group-hover:size-3 transition-all" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
