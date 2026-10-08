/**
 * Widget registry for the customisable trading terminal.
 *
 * Every dockable pane is a widget with a stable id. The dock layout only ever
 * references widgets by id, so renaming or removing one here is a breaking
 * change for persisted layouts — bump LAYOUT_SCHEMA_VERSION in layout-storage
 * when you do.
 */
import { memo, useEffect, useRef, useState, type ComponentType } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Orderbook } from '@/features/orderbook-view';
import { Trades } from '@/features/orderbook-view/ui/Trades';
import { PerpsChartContainer } from '@/features/chart/ui/PerpsChartContainer';
import { TradeTicket } from '@/features/order-placement';
import { MyOrders } from '@/features/order-placement/ui/MyOrders';
import { MyPositions } from '@/features/order-placement/ui/MyPositions';
import { MyTrades } from '@/features/order-placement/ui/MyTrades';
import { MyAssets } from '@/features/order-placement/ui/MyAssets';
import { AccountCard } from '@/shared/ui/account-card';

export type WidgetId =
  | 'chart'
  | 'orderbook'
  | 'trades'
  | 'ticket'
  | 'account'
  | 'positions'
  | 'orders'
  | 'my-trades'
  | 'assets';

export interface WidgetDefinition {
  id: WidgetId;
  title: string;
  component: ComponentType<IDockviewPanelProps>;
  minimumWidth?: number;
  minimumHeight?: number;
}

const Pane = ({ children }: { children: React.ReactNode }) => (
  <div className="h-full w-full min-h-0 min-w-0 flex flex-col overflow-hidden bg-background">
    {children}
  </div>
);

/** Quiet, centred one-liner for panes with nothing to show yet. */
export const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-full min-h-24 items-center justify-center p-4 text-xs text-rock/45">
    {children}
  </div>
);

const Scroll = ({ children }: { children: React.ReactNode }) => (
  <div className="h-full w-full overflow-auto">{children}</div>
);

const ChartWidget = memo(() => (
  <Pane>
    <PerpsChartContainer />
  </Pane>
));
ChartWidget.displayName = 'ChartWidget';

const OrderbookWidget = memo(() => (
  <Pane>
    <Orderbook standalone />
  </Pane>
));
OrderbookWidget.displayName = 'OrderbookWidget';

const TRADE_ROW_PX = 22;
const TRADE_HEADER_PX = 29;
/** Below this width the Buyer/Seller/Time columns don't fit; fall back to Price/Size/Total. */
const TRADE_FULL_VIEW_MIN_PX = 520;

/** Recent market trades in a standalone pane; row count follows the pane height. */
const TradesWidget = memo(() => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState(20);
  const [fullView, setFullView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => {
      setRows(Math.max(5, Math.floor((node.clientHeight - TRADE_HEADER_PX) / TRADE_ROW_PX)));
      setFullView(node.clientWidth >= TRADE_FULL_VIEW_MIN_PX);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  return (
    <Pane>
      <div ref={ref} className="flex flex-col h-full">
        {fullView ? (
          <div className="grid grid-cols-6 h-7 items-center px-3 text-[11px] text-rock/50 bg-card border-b border-outline shrink-0">
            <div className="text-left font-mono">Price</div>
            <div className="text-center font-mono">Size</div>
            <div className="text-center font-mono">Total</div>
            <div className="text-center font-mono">Buyer</div>
            <div className="text-center font-mono">Seller</div>
            <div className="text-right font-mono">Time</div>
          </div>
        ) : (
          <div className="grid grid-cols-3 h-7 items-center px-3 text-[11px] text-rock/50 bg-card border-b border-outline shrink-0">
            <div className="text-left font-mono">Price</div>
            <div className="text-right font-mono">Size</div>
            <div className="text-right font-mono">Total</div>
          </div>
        )}
        <div className="flex-1 min-h-0">
          <Trades rows={rows} fullView={fullView} />
        </div>
      </div>
    </Pane>
  );
});
TradesWidget.displayName = 'TradesWidget';

const TicketWidget = memo(() => (
  <Pane>
    <Scroll>
      <TradeTicket fluid />
    </Scroll>
  </Pane>
));
TicketWidget.displayName = 'TicketWidget';

const AccountWidget = memo(() => {
  const { publicKey } = useWallet();
  return (
    <Pane>
      {publicKey ? (
        <Scroll>
          <AccountCard />
        </Scroll>
      ) : (
        <EmptyState>Connect a wallet to see your account</EmptyState>
      )}
    </Pane>
  );
});
AccountWidget.displayName = 'AccountWidget';

const PositionsWidget = memo(() => (
  <Pane>
    <Scroll>
      <MyPositions />
    </Scroll>
  </Pane>
));
PositionsWidget.displayName = 'PositionsWidget';

const OrdersWidget = memo(() => (
  <Pane>
    <Scroll>
      <MyOrders />
    </Scroll>
  </Pane>
));
OrdersWidget.displayName = 'OrdersWidget';

const MyTradesWidget = memo(() => (
  <Pane>
    <Scroll>
      <MyTrades />
    </Scroll>
  </Pane>
));
MyTradesWidget.displayName = 'MyTradesWidget';

const AssetsWidget = memo(() => (
  <Pane>
    <Scroll>
      <MyAssets />
    </Scroll>
  </Pane>
));
AssetsWidget.displayName = 'AssetsWidget';

export const WIDGETS: readonly WidgetDefinition[] = [
  { id: 'chart', title: 'Chart', component: ChartWidget, minimumWidth: 320, minimumHeight: 240 },
  { id: 'orderbook', title: 'Orderbook', component: OrderbookWidget, minimumWidth: 240 },
  { id: 'trades', title: 'Trades', component: TradesWidget, minimumWidth: 240 },
  { id: 'ticket', title: 'Trade', component: TicketWidget, minimumWidth: 320 },
  { id: 'account', title: 'Account', component: AccountWidget, minimumWidth: 240 },
  { id: 'positions', title: 'Positions', component: PositionsWidget, minimumHeight: 120 },
  { id: 'orders', title: 'Orders', component: OrdersWidget, minimumHeight: 120 },
  { id: 'my-trades', title: 'My Trades', component: MyTradesWidget, minimumHeight: 120 },
  { id: 'assets', title: 'Assets', component: AssetsWidget, minimumHeight: 120 },
];

export const WIDGET_BY_ID: Record<WidgetId, WidgetDefinition> = Object.fromEntries(
  WIDGETS.map(w => [w.id, w])
) as Record<WidgetId, WidgetDefinition>;

export const isWidgetId = (id: string): id is WidgetId => id in WIDGET_BY_ID;

/** Stable `components` map for DockviewReact (identity must not change between renders). */
export const DOCK_COMPONENTS: Record<
  string,
  ComponentType<IDockviewPanelProps>
> = Object.fromEntries(WIDGETS.map(w => [w.id, w.component]));
