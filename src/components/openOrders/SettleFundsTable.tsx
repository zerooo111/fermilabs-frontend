import React from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/Table';
import Button from '../ui/Button';
import { useAtomValue } from 'jotai';
import { marketAccountAtom } from '@/atoms/market';
import { useOpenOrdersAccount } from '@/hooks/useOpenOrdersAccount';
import Copyable from '../shared/Copyable';
import { shortenAddress } from '@/solana/utils/helpers';

const SettleFundsTable = () => {
  const marketAccount = useAtomValue(marketAccountAtom);
  const { data } = useOpenOrdersAccount();

  if (!data?.publicKey) {
    return <div>No open orders account found</div>;
  }

  return (
    <div className="overflow-hidden rounded-md">
      <Table>
        <TableCaption>Settle Funds of your account</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px] text-center">Token</TableHead>
            <TableHead className="text-center">Token Mint Address</TableHead>
            <TableHead className="text-center">Amount Claimable</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="w-[100px] text-center">JUP</TableCell>
            <TableCell className="text-center">
              <Copyable
                textToCopy={marketAccount?.baseMint.toString() ?? '-'}
                className="flex justify-center items-center gap-1"
              >
                {shortenAddress(marketAccount?.baseMint.toString() ?? '-')}
                <Copyable.Icon className="w-[15px] h-[15px]" />
              </Copyable>
            </TableCell>
            <TableCell className="text-center">0</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="w-[100px] text-center">USDC</TableCell>
            <TableCell className="text-center">
              <Copyable
                textToCopy={marketAccount?.quoteMint.toString() ?? '-'}
                className="flex justify-center items-center gap-1"
              >
                {shortenAddress(marketAccount?.quoteMint.toString() ?? '-')}
                <Copyable.Icon className="w-[15px] h-[15px]" />
              </Copyable>
            </TableCell>
            <TableCell className="text-center">0</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <div>{data?.publicKey && <Button variant={'success'}>Settle Funds</Button>}</div>
    </div>
  );
};

export default SettleFundsTable;
