/**
 * Trade panel component
 * Allows users to place buy and sell orders
 */
import { Button } from '@/shared/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { useState } from 'react';
import { OrderIntent } from '@/features/order-placement/lib/OrderIntent';
import { useMarketTokenBalances } from '@/features/order-placement/lib/useMarketTokenBalances';
import { createHash } from 'crypto';
import { BN } from '@coral-xyz/anchor';
import { ExternalLinkIcon, RefreshCw, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { baseMint, quoteMint } from '@/shared/config/constants';
import { NumberInput } from '@/shared/ui/number-input';
import { useSequencerApi } from '@/shared/api/useSequencerApi';
import { useSelectedMarket } from '@/entities/market';

export function TradePanel() {
  const [formState, setFormState] = useState({
    price: 0,
    size: 0,
    orderType: 'limit',
  });
  const [isBuying, setIsBuying] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const { submitOrderToSequencer } = useSequencerApi();
  const { selectedMarket } = useSelectedMarket();
  const {
    balances,
    isLoading: balancesLoading,
    refetch: refetchBalances,
  } = useMarketTokenBalances();

  const { signMessage, publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const placeOrderIntent = async (intent: OrderIntent) => {
    if (!signMessage) throw new Error('Wallet not connected!');

    const serializedData = OrderIntent.serialize(intent);
    const prefix = Buffer.from('FRM_DEX_ORDER:');

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

    const receipt = await submitOrderToSequencer(body);

    return receipt;
  };

  const placeSellOrder = async () => {
    if (!connected) {
      setVisible(true);
      return;
    }

    try {
      setIsSelling(true);
      if (!publicKey) throw new Error('Wallet not connected!');
      const orderId = new BN(Math.floor(Math.random() * 10000000));

      const baseMintPubkey = selectedMarket ? new PublicKey(selectedMarket.base_mint) : baseMint;
      const quoteMintPubkey = selectedMarket ? new PublicKey(selectedMarket.quote_mint) : quoteMint;

      const intent = new OrderIntent(
        orderId,
        publicKey,
        'Sell',
        new BN(formState.price).mul(new BN(10 ** 9)),
        new BN(formState.size).mul(new BN(10 ** 9)),
        new BN(Date.now() + 60 * 60 * 1000),
        baseMintPubkey,
        quoteMintPubkey
      );

      const response = await placeOrderIntent(intent);
      console.log('Order placed', { response });
      toast.success('Sell Order placed');
    } catch (error) {
      console.error(error);
      toast.error('Failed to place order');
    } finally {
      setIsSelling(false);
    }
  };

  const placeBuyOrder = async () => {
    if (!connected) {
      setVisible(true);
      return;
    }

    try {
      setIsBuying(true);
      if (!publicKey) throw new Error('Wallet not connected!');
      const orderId = new BN(Math.floor(Math.random() * 10000000));

      const baseMintPubkey = selectedMarket ? new PublicKey(selectedMarket.base_mint) : baseMint;
      const quoteMintPubkey = selectedMarket ? new PublicKey(selectedMarket.quote_mint) : quoteMint;

      const intent = new OrderIntent(
        orderId,
        publicKey,
        'Buy',
        new BN(formState.price).mul(new BN(10 ** 9)),
        new BN(formState.size).mul(new BN(10 ** 9)),
        new BN(Date.now() + 60 * 60 * 1000),
        baseMintPubkey,
        quoteMintPubkey
      );
      const response = await placeOrderIntent(intent);
      console.log('Order placed', { response });
      toast.success('Buy Order placed');
    } catch (error) {
      console.error(error);
      toast.error('Failed to place order');
    } finally {
      setIsBuying(false);
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
          unit={selectedMarket?.quoteTokenName}
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
          unit={selectedMarket?.baseTokenName}
        />

        {!connected ? (
          <Button
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
            onClick={() => setVisible(true)}
          >
            <Wallet className="size-4" />
            Connect Wallet to Trade
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="default"
              disabled={!formState.price || !formState.size || isBuying}
              onClick={placeBuyOrder}
            >
              {isBuying ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Buying...
                </>
              ) : (
                'Buy'
              )}
            </Button>
            <Button
              variant="default"
              disabled={!formState.price || !formState.size || isSelling}
              onClick={placeSellOrder}
            >
              {isSelling ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Selling...
                </>
              ) : (
                'Sell'
              )}
            </Button>
          </div>
        )}
        <div className="bg-gray-100 font-medium rounded-sm p-2 text-xs space-y-1 mt-auto">
          {/* Wallet Balances Section */}
          <div className="mb-2 pb-2 border-b border-gray-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-nowrap font-semibold">Your Balances</span>
              <button
                onClick={() => refetchBalances()}
                className="text-blue-600 hover:text-blue-800 transition-colors"
                title="Refresh balances"
                disabled={!connected}
              >
                <RefreshCw className={`size-3 ${balancesLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {!connected ? (
              <div className="text-xs text-gray-500 italic">Connect wallet to view balances</div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-nowrap">
                    Base ({selectedMarket?.baseTokenName || 'BASE'})
                  </span>
                  <span className="tabular-nums">
                    {balancesLoading ? '0' : balances.baseBalance}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-nowrap">
                    Quote ({selectedMarket?.quoteTokenName || 'QUOTE'})
                  </span>
                  <span className="tabular-nums">
                    {balancesLoading ? '0' : balances.quoteBalance}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Order Info Section */}
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
              href={`https://solscan.io/token/${selectedMarket?.base_mint || baseMint.toBase58()}`}
              className="group tabular-nums inline-flex items-center gap-1 font-normal text-neutral-600 hover:text-blue-600 transition-colors"
              target="_blank"
              title={selectedMarket?.base_mint || baseMint.toBase58()}
            >
              {selectedMarket?.base_mint
                ? `${selectedMarket.base_mint.slice(0, 8)}...${selectedMarket.base_mint.slice(-8)}`
                : `${baseMint.toBase58().slice(0, 8)}...${baseMint.toBase58().slice(-8)}`}
              <ExternalLinkIcon className="size-0 group-hover:size-3 transition-all" />
            </a>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-nowrap">Quote Token</span>
            <a
              href={`https://solscan.io/token/${selectedMarket?.quote_mint || quoteMint.toBase58()}`}
              className="group tabular-nums inline-flex items-center gap-1 font-normal text-neutral-600 hover:text-blue-600 transition-colors"
              target="_blank"
              title={selectedMarket?.quote_mint || quoteMint.toBase58()}
            >
              {selectedMarket?.quote_mint
                ? `${selectedMarket.quote_mint.slice(0, 8)}...${selectedMarket.quote_mint.slice(-8)}`
                : `${quoteMint.toBase58().slice(0, 8)}...${quoteMint.toBase58().slice(-8)}`}
              <ExternalLinkIcon className="size-0 group-hover:size-3 transition-all" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
