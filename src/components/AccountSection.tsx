import { useOpenOrdersAccount } from '@/hooks/useOpenOrdersAccount';
import { CreateOpenOrdersAccountForm } from './CreateOpenOrdersAccountForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import OpenOrdersTable from './openOrders/OpenOrdersTable';
import SettleFundsTable from './openOrders/SettleFundsTable';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { ConnectWallet } from './ConnectWallet';

const AccountSection = () => {
  const { data, isPending, error } = useOpenOrdersAccount();
  const connectedWallet = useAnchorWallet();

  if (!connectedWallet) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <ConnectWallet />
      </div>
    );
  }

  /* Data is not yet loaded */
  if (isPending) {
    return <div>Loading...</div>;
  }

  /* Error loading data */
  if (error) {
    return <div>Error: {error.message}</div>;
  }

  /* No open orders account found -- show create open orders account form */
  if (!data?.publicKey) {
    return <CreateOpenOrdersAccountForm />;
  }

  /* We have open orders account*/
  return (
    <div className="h-full w-full p-1">
      <Tabs defaultValue="open-orders">
        <TabsList>
          <TabsTrigger value="open-orders">Open Orders</TabsTrigger>
          <TabsTrigger value="settle-fund">Settle Fund</TabsTrigger>
        </TabsList>
        <TabsContent value="open-orders">
          <OpenOrdersTable />
        </TabsContent>
        <TabsContent value="settle-fund">
          <SettleFundsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AccountSection;
