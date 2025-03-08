import { useOpenOrdersAccount } from '@/hooks/useOpenOrdersAccount';
import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/Table';
import Button from '../ui/Button';

const OpenOrdersTable = () => {
  const { data: openOrdersData } = useOpenOrdersAccount();

  if (!openOrdersData?.publicKey) {
    return <div>No open orders account found</div>;
  }

  return (
    <div className="overflow-hidden rounded-md">
      <Table>
        <TableCaption>Open orders of your account</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Sl. No.</TableHead>
            <TableHead>Side</TableHead>
            <TableHead>OrderId</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {openOrdersData.openOrders.map(order => (
            <TableRow key={order.id}>
              <TableCell className="w-[100px]">{order.slNo}</TableCell>
              <TableCell>
                <span
                  className={`${order.side === 0 ? 'text-emerald-500 rounded-md p-1 px-2 bg-emerald-100 border border-emerald-500' : 'text-red-500 rounded-md p-1 px-2 bg-red-100 border border-red-500'} font-bold uppercase`}
                >
                  {order.side === 0 ? 'Buy' : 'Sell'}
                </span>
              </TableCell>
              <TableCell>{order.id}</TableCell>
              <TableCell>{order.price}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button>Cancel</Button>
                  <Button disabled={!order.finalisable}>Finalise</Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default OpenOrdersTable;
