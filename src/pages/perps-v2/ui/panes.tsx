// Dockview pane components. Each one wraps a live /perps feature unchanged;
// the v2 look comes from the token overrides in perps-v2.css, so the two
// routes keep sharing one implementation of trading logic.

import { memo, type ReactNode } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';

import { PerpsChartContainer } from '@/features/chart/ui/PerpsChartContainer';
import { Orderbook } from '@/features/orderbook-view';
import { TradeTicket } from '@/features/order-placement';
import { MyOrders } from '@/features/order-placement/ui/MyOrders';
import { MyPositions } from '@/features/order-placement/ui/MyPositions';
import { MyTrades } from '@/features/order-placement/ui/MyTrades';
import { MyAssets } from '@/features/order-placement/ui/MyAssets';
import { Trades } from '@/features/orderbook-view/ui/Trades';
import { AccountCard } from '@/shared/ui/account-card';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

import type { PaneId } from '../lib/panels';

function Pane({ kind, children }: { kind: PaneId; children: ReactNode }) {
  return (
    <div className={`pv2-pane pv2-${kind}`}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </div>
  );
}

const TAPE_COLUMNS = ['Price', 'Size', 'Total', 'Buyer', 'Seller', 'Time'];

function TapePane() {
  return (
    <Pane kind="tape">
      <div className="pv2-colhead grid grid-cols-6">
        {TAPE_COLUMNS.map((c, i) => (
          <span key={c} className={i === 0 ? 'text-left' : i === 5 ? 'text-right' : 'text-center'}>
            {c}
          </span>
        ))}
      </div>
      <div className="pv2-tape-body">
        <Trades rows={40} fullView />
      </div>
    </Pane>
  );
}

const pane = (kind: PaneId, Content: () => ReactNode) =>
  memo(function DockPane(_: IDockviewPanelProps) {
    return (
      <Pane kind={kind}>
        <Content />
      </Pane>
    );
  });

export const paneComponents: Record<PaneId, React.FunctionComponent<IDockviewPanelProps>> = {
  chart: pane('chart', () => <PerpsChartContainer hideMarketHeader />),
  book: pane('book', () => <Orderbook />),
  trade: pane('trade', () => <TradeTicket />),
  account: pane('account', () => <AccountCard />),
  positions: pane('positions', () => <MyPositions />),
  orders: pane('orders', () => <MyOrders />),
  fills: pane('fills', () => <MyTrades />),
  assets: pane('assets', () => <MyAssets />),
  tape: memo(TapePane),
};
