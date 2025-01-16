import { ColumnDef } from '@tanstack/react-table';
import Button from '@/components/ui/Button';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';

/**
 * Type definition for OpenOrder data structure
 */
export type OpenOrder = {
  slNo: number;
  orderId: string;
  timestamp: number;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
};

/**
 * Column definitions for the OpenOrders table
 */
export const columns: ColumnDef<OpenOrder>[] = [
  {
    accessorKey: 'slNo',
    header: 'Sl.No',
  },
  {
    accessorKey: 'orderId',
    header: 'Order ID',
  },
  {
    accessorKey: 'timestamp',
    header: 'Time',
    cell: ({ row }) => {
      const timestamp = row.getValue('timestamp') as number;
      const date = new Date(timestamp);
      return <div>{date.toLocaleString()}</div>;
    },
  },
  {
    accessorKey: 'side',
    header: 'Side',
    cell: ({ row }) => {
      const side = row.getValue('side') as string;
      return (
        <div className={side === 'buy' ? 'text-green-600' : 'text-red-600'}>
          {side.toUpperCase()}
        </div>
      );
    },
  },
  {
    accessorKey: 'price',
    header: () => <div className="text-right">Price</div>,
    cell: ({ row }) => {
      const price = parseFloat(row.getValue('price'));
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(price);
      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: 'quantity',
    header: () => <div className="text-right">Quantity</div>,
    cell: ({ row }) => {
      const quantity = parseFloat(row.getValue('quantity'));
      return <div className="text-right font-medium">{quantity.toFixed(2)}</div>;
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const order = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                // Handle cancel action
                console.log('Cancel order:', order.orderId);
              }}
              className="text-red-600"
            >
              Cancel Order
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                // Handle finalize action
                console.log('Finalize order:', order.orderId);
              }}
            >
              Finalize Order
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
