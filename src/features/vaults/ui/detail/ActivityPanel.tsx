/** What the vault holds right now, its recent trades and its biggest depositors. */
import { Badge } from '@/shared/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Panel } from '@/shared/ui/panel';
import { cn } from '@/lib/utils';

import { formatDateTime, num, price, shortAddress, tone, usd, usdSigned } from '../../model/format';
import type { Vault } from '../../model/types';

const HEAD = 'text-xs font-normal text-fg-tertiary';

export function ActivityPanel({ vault }: { vault: Vault }) {
  return (
    <Panel>
      <Tabs defaultValue="positions">
        <TabsList className="h-10 w-full justify-start overflow-x-auto border-b border-line-subtle bg-surface-raised">
          <TabsTrigger value="positions">Open positions</TabsTrigger>
          <TabsTrigger value="trades">Recent trades</TabsTrigger>
          <TabsTrigger value="depositors">Depositors</TabsTrigger>
        </TabsList>

        <TabsContent value="positions">
          <Table>
            <TableHeader className="bg-surface-raised">
              <TableRow className="hover:bg-transparent">
                <TableHead className={cn(HEAD, 'pl-4')}>Market</TableHead>
                <TableHead className={cn(HEAD, 'text-right')}>Size</TableHead>
                <TableHead className={cn(HEAD, 'text-right')}>Entry price</TableHead>
                <TableHead className={cn(HEAD, 'text-right')}>Current price</TableHead>
                <TableHead className={cn(HEAD, 'pr-4 text-right')}>Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vault.positions.map(p => (
                <TableRow key={p.market}>
                  <TableCell className="py-2.5 pl-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-fg-primary">
                        {p.market.replace('-PERP', '')}
                      </span>
                      <Badge
                        variant={p.side === 'long' ? 'positive' : 'negative'}
                        className="px-1.5 text-[11px] capitalize"
                      >
                        {p.side}
                      </Badge>
                    </div>
                  </TableCell>
                  <Num>{num(p.size, p.size < 10 ? 4 : 1)}</Num>
                  <Num>{price(p.entryPrice)}</Num>
                  <Num>{price(p.markPrice)}</Num>
                  <Num className={cn('pr-4', tone(p.unrealizedPnl))}>
                    {usdSigned(p.unrealizedPnl)}
                  </Num>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="trades">
          <Table containerClassName="max-h-[22rem] overflow-y-auto">
            <TableHeader className="sticky top-0 z-10 bg-surface-raised">
              <TableRow className="hover:bg-transparent">
                <TableHead className={cn(HEAD, 'pl-4')}>Time</TableHead>
                <TableHead className={HEAD}>Market</TableHead>
                <TableHead className={cn(HEAD, 'text-right')}>Price</TableHead>
                <TableHead className={cn(HEAD, 'text-right')}>Size</TableHead>
                <TableHead className={cn(HEAD, 'pr-4 text-right')}>Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vault.trades.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="py-2 pl-4 text-xs text-fg-secondary">
                    {formatDateTime(t.time)}
                  </TableCell>
                  <TableCell className="text-sm text-fg-primary">
                    <span
                      className={cn(
                        'mr-2 text-xs',
                        t.side === 'buy' ? 'text-positive-fg' : 'text-negative-fg'
                      )}
                    >
                      {t.side === 'buy' ? 'Buy' : 'Sell'}
                    </span>
                    {t.market.replace('-PERP', '')}
                  </TableCell>
                  <Num>{price(t.price)}</Num>
                  <Num>{num(t.size, t.size < 10 ? 4 : 1)}</Num>
                  <Num
                    className={cn(
                      'pr-4',
                      t.closedPnl === null ? 'text-fg-disabled' : tone(t.closedPnl)
                    )}
                  >
                    {t.closedPnl === null ? '-' : usdSigned(t.closedPnl)}
                  </Num>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="depositors">
          <Table>
            <TableHeader className="bg-surface-raised">
              <TableRow className="hover:bg-transparent">
                <TableHead className={cn(HEAD, 'pl-4')}>Depositor</TableHead>
                <TableHead className={cn(HEAD, 'text-right')}>Deposit</TableHead>
                <TableHead className={cn(HEAD, 'pr-4 text-right')}>Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vault.depositors.map(d => (
                <TableRow key={d.address}>
                  <TableCell className="py-2.5 pl-4">
                    <span className="font-mono text-xs text-fg-primary">
                      {shortAddress(d.address)}
                    </span>
                    {d.isLeader && <span className="ml-2 text-xs text-fg-tertiary">Manager</span>}
                  </TableCell>
                  <Num>{usd(d.equity)}</Num>
                  <Num className={cn('pr-4', tone(d.allTimePnl))}>{usdSigned(d.allTimePnl)}</Num>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </Panel>
  );
}

function Num({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableCell
      className={cn('text-right font-mono text-xs tabular-nums text-fg-primary', className)}
    >
      {children}
    </TableCell>
  );
}
