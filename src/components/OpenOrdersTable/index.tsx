import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import { columns, OpenOrder } from './columns';
import { useOpenOrdersAccount } from '@/hooks/useOpenOrdersAccount';

/**
 * Generate dummy orders for development
 */
const generateDummyOrders = (count: number): OpenOrder[] => {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    slNo: i + 1,
    orderId: `ORDER${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    timestamp: now - i * 1000 * 60 * 5, // Each order 5 minutes apart
    side: Math.random() > 0.5 ? 'buy' : 'sell',
    price: 100 + Math.random() * 10, // Random price between 100 and 110
    quantity: 1 + Math.random() * 5, // Random quantity between 1 and 6
  }));
};

// Dummy data for development
const dummyOrders = generateDummyOrders(15);

/**
 * OpenOrdersTable component displays user's open orders in a data table
 */
const OpenOrdersTable = () => {
  const { data: openOrdersData, isLoading } = useOpenOrdersAccount();

  // Transform openOrdersData into the format expected by the table
  const data = React.useMemo<OpenOrder[]>(() => {
    // Use real data if available, otherwise use dummy data
    if (openOrdersData?.account.openOrders) {
      return openOrdersData.account.openOrders.map((order, index) => ({
        slNo: index + 1,
        orderId: order.orderId.toString(),
        timestamp: order.timestamp.toNumber() * 1000,
        side: order.side === 0 ? 'buy' : 'sell',
        price: order.price,
        quantity: order.size,
      }));
    }

    // Return dummy data for development
    return dummyOrders;
  }, [openOrdersData]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 8,
      },
    },
  });

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
        Loading open orders...
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-1 bg-zinc-100 rounded-md border border-zinc-300"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="rounded-md border bg-white border-zinc-300 shadow-lg overflow-hidden"
      >
        <Table>
          <TableHeader>
            <TableRow>
              {table.getHeaderGroups()[0].headers.map(header => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="wait">
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row, index) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className={`border-b border-zinc-300 transition-colors hover:bg-zinc-50 data-[state=selected]:bg-zinc-100`}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </motion.tr>
                ))
              ) : (
                <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No open orders
                  </TableCell>
                </motion.tr>
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between px-4 py-4"
        >
          <div className="text-sm text-zinc-500">
            Showing {table.getRowModel().rows.length} orders
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <div className="text-sm text-zinc-500">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default OpenOrdersTable;
