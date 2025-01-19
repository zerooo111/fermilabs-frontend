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
  const { data } = useOpenOrdersAccount();

  if (!data?.publicKey) {
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
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="w-[100px]">1</TableCell>
            <TableCell>Buy</TableCell>
            <TableCell>1234567890</TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button>Cancel</Button>
                <Button>Finalise</Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default OpenOrdersTable;
