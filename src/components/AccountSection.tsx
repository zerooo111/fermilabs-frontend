import { useOpenOrdersAccount } from '@/hooks/useOpenOrdersAccount';
import { CreateOpenOrdersAccountForm } from './CreateOpenOrdersAccountForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import OpenOrdersTable from './openOrders/OpenOrdersTable';

const AccountSection = () => {
  const { data, isPending, error } = useOpenOrdersAccount();

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
        <TabsContent value="settle-fund">Settle funds section</TabsContent>
      </Tabs>
    </div>
  );
};

export default AccountSection;
