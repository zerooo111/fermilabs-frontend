/**
 * What the vault holds on Fermi, as tabbed tables under the vault page:
 * perp positions with their unsettled PnL, resting orders, and collateral
 * with account health. All indicative: none of it is a deposit or
 * withdrawal price.
 */
import { useState, type ReactNode } from 'react';
import type { PublicKey } from '@solana/web3.js';

import { cn } from '@/lib/utils';
import { Eyebrow } from '@/shared/ui/panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { TabStrip, TabStripItem } from '@/shared/ui/tab-strip';

import type { FlpEnvelope, FlpPosition } from '../model/api';
import { FLP_MARKET_BASE_DECIMALS } from '../model/config';
import { fixedScaled, fixedToNative, formatSigned, formatUnits } from '../model/format';
import { useFlpOrders, useFlpVault } from '../model/useFlpVault';
import { portfolioOf, portfolioUnavailable } from '../model/view';

type Tab = 'positions' | 'orders' | 'balances';
const TH = 'h-9 px-2 sm:px-4';
const TD = 'px-2 py-2.5 sm:px-4 font-mono text-xs tabular-nums';

export function Holdings({ vault }: { vault: PublicKey }) {
  const { envelope } = useFlpVault(vault);
  const [tab, setTab] = useState<Tab>('positions');
  const portfolio = envelope ? portfolioOf(envelope) : null;
  const { orders, loading } = useFlpOrders(vault, envelope);
  const open = portfolio?.positions.filter(p => p.baseLots !== '0') ?? [];

  return (
    <section className="flex flex-col border border-outline">
      <div className="flex items-center justify-between gap-3 border-b border-outline bg-card px-3 py-1.5 sm:px-4">
        <TabStrip
          id="flp-holdings"
          active={tab}
          className="-mb-1.5 flex overflow-x-auto"
          role="tablist"
        >
          <TabStripItem
            value="positions"
            onSelect={() => setTab('positions')}
            className="h-9 gap-2"
          >
            Positions
            <Count n={portfolio ? open.length : undefined} />
          </TabStripItem>
          <TabStripItem value="orders" onSelect={() => setTab('orders')} className="h-9 gap-2">
            Open orders
            <Count n={loading ? undefined : orders.length} />
          </TabStripItem>
          <TabStripItem value="balances" onSelect={() => setTab('balances')} className="h-9">
            Balances
          </TabStripItem>
        </TabStrip>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-rock/60 sm:block">
          Indicative
        </span>
      </div>

      {!envelope ? (
        <Message>Loading…</Message>
      ) : !portfolio ? (
        <Message>{portfolioUnavailable(envelope)}</Message>
      ) : tab === 'positions' ? (
        <Positions positions={portfolio.positions} qd={envelope.data.units.quoteDecimals} />
      ) : tab === 'orders' ? (
        <Orders envelope={envelope} orders={orders} />
      ) : (
        <Balances envelope={envelope} />
      )}
    </section>
  );
}

function Positions({ positions, qd }: { positions: FlpPosition[]; qd: number }) {
  if (!positions.length) return <Message>No positions. The vault holds only USDC.</Message>;
  return (
    <Table className="min-w-[44rem]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <Head left>Market</Head>
          <Head>Size</Head>
          <Head>Position value</Head>
          <Head>Mark price</Head>
          <Head>Unsettled PnL</Head>
          <Head>Funding</Head>
        </TableRow>
      </TableHeader>
      <TableBody>
        {positions.map(p => {
          const bd = FLP_MARKET_BASE_DECIMALS[p.marketIndex] ?? qd;
          const lots = BigInt(p.baseLots);
          const size = lots * BigInt(p.baseLotSize);
          const pnl = fixedToNative(p.unsettledPnlSettlementNative);
          const exposure = fixedToNative(p.signedExposureSettlementNative);
          const side = lots > 0n ? 'long' : lots < 0n ? 'short' : 'flat';
          return (
            <TableRow key={p.marketIndex} className={cn(side === 'flat' && 'text-rock/60')}>
              <TableCell
                className={cn(
                  TD,
                  'border-l-2 font-sans text-sm',
                  side === 'long'
                    ? 'border-l-success text-rock'
                    : side === 'short'
                      ? 'border-l-danger text-rock'
                      : 'border-l-transparent'
                )}
              >
                {p.name}
              </TableCell>
              <TableCell
                className={cn(
                  TD,
                  'text-right',
                  side === 'long' && 'text-success',
                  side === 'short' && 'text-danger'
                )}
              >
                {side === 'flat' ? '0' : formatUnits(size, bd, 4)}
              </TableCell>
              <TableCell className={cn(TD, 'text-right')}>
                {formatUnits(exposure < 0n ? -exposure : exposure, qd, 2)} USDC
              </TableCell>
              <TableCell className={cn(TD, 'text-right')}>
                {formatUnits(fixedScaled(p.oraclePriceSettlementNativePerBaseNative, bd), qd, 4)}
              </TableCell>
              <TableCell className={cn(TD, 'text-right', tone(pnl))}>
                {formatSigned(pnl, qd, 2)}
              </TableCell>
              <TableCell className={cn(TD, 'text-right')}>
                {formatSigned(fixedToNative(p.unsettledFundingNative), qd, 2)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function Orders({
  envelope,
  orders,
}: {
  envelope: FlpEnvelope;
  orders: ReturnType<typeof useFlpOrders>['orders'];
}) {
  const qd = envelope.data.units.quoteDecimals;
  const portfolio = portfolioOf(envelope);
  const markets = new Map(portfolio?.positions.map(p => [p.marketIndex, p]) ?? []);
  if (!orders.length)
    return (
      <Message>No open orders right now. The devnet market maker quotes during test runs.</Message>
    );
  return (
    <Table className="min-w-[32rem]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <Head left>Market</Head>
          <Head>Side</Head>
          <Head>Price</Head>
          <Head>Size</Head>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((o, i) => {
          const p = markets.get(o.marketIndex);
          const bd = FLP_MARKET_BASE_DECIMALS[o.marketIndex] ?? qd;
          const baseLot = BigInt(p?.baseLotSize ?? '1');
          const quoteLot = BigInt(p?.quoteLotSize ?? '1');
          // price_lots × quote lot / base lot is native quote per native base.
          const price = (BigInt(o.price_lots) * quoteLot * 10n ** BigInt(bd)) / baseLot;
          const bid = /bid|buy/i.test(o.side);
          return (
            <TableRow key={`${o.marketIndex}-${o.client_order_id ?? i}`}>
              <TableCell className={cn(TD, 'font-sans text-sm text-rock')}>
                {p?.name ?? `Market ${o.marketIndex}`}
              </TableCell>
              <TableCell className={cn(TD, 'text-right', bid ? 'text-success' : 'text-danger')}>
                {bid ? 'Buy' : 'Sell'}
              </TableCell>
              <TableCell className={cn(TD, 'text-right')}>{formatUnits(price, qd, 4)}</TableCell>
              <TableCell className={cn(TD, 'text-right')}>
                {formatUnits(BigInt(o.base_lots) * baseLot, bd, 4)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function Balances({ envelope }: { envelope: FlpEnvelope }) {
  const portfolio = portfolioOf(envelope)!;
  const qd = envelope.data.units.quoteDecimals;
  const unsettled = fixedToNative(portfolio.valuation.unsettledPerpQuoteNative);
  return (
    <Table className="min-w-[32rem]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <Head left>Asset</Head>
          <Head>Balance</Head>
          <Head>Value</Head>
        </TableRow>
      </TableHeader>
      <TableBody>
        {portfolio.collateral.map(c => (
          <TableRow key={c.tokenIndex}>
            <TableCell className={cn(TD, 'font-sans text-sm text-rock')}>
              {c.tokenIndex === 0 ? 'USDC' : `Token ${c.tokenIndex}`}
            </TableCell>
            <TableCell className={cn(TD, 'text-right')}>
              {formatUnits(fixedToNative(c.balanceNative), c.decimals, 2)}
            </TableCell>
            <TableCell className={cn(TD, 'text-right')}>
              {formatUnits(fixedToNative(c.quoteValueNative), qd, 2)} USDC
            </TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell className={cn(TD, 'font-sans text-sm text-rock/70')}>
            Unsettled perp PnL
          </TableCell>
          <TableCell className={TD} />
          <TableCell className={cn(TD, 'text-right', tone(unsettled))}>
            {formatSigned(unsettled, qd, 2)} USDC
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function tone(n: bigint) {
  return n > 0n ? 'text-success' : n < 0n ? 'text-danger' : undefined;
}

function Head({ children, left }: { children: ReactNode; left?: boolean }) {
  return (
    <TableHead className={cn(TH, !left && 'text-right')}>
      <Eyebrow>{children}</Eyebrow>
    </TableHead>
  );
}

function Count({ n }: { n?: number }) {
  return n === undefined ? null : (
    <span className="font-mono text-[11px] tabular-nums text-rock/60">{n}</span>
  );
}

function Message({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-xs text-rock/60">{children}</p>;
}
