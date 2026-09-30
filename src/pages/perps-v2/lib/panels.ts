// Registry of every pane the v2 terminal can show. Layout presets and the
// toolbar both read from here, so adding a pane is one entry plus a component.

export type PaneId =
  | 'chart'
  | 'book'
  | 'trade'
  | 'account'
  | 'positions'
  | 'orders'
  | 'fills'
  | 'assets'
  | 'tape';

export type PaneDef = {
  id: PaneId;
  title: string;
  /** Where the pane goes back to when reopened from the toolbar */
  home: 'grid' | 'bottom';
};

export const PANES: PaneDef[] = [
  { id: 'chart', title: 'Chart', home: 'grid' },
  { id: 'book', title: 'Order book', home: 'grid' },
  { id: 'trade', title: 'Trade', home: 'grid' },
  { id: 'account', title: 'Account', home: 'grid' },
  { id: 'positions', title: 'Positions', home: 'bottom' },
  { id: 'orders', title: 'Open orders', home: 'bottom' },
  { id: 'fills', title: 'My trades', home: 'bottom' },
  { id: 'assets', title: 'Assets', home: 'bottom' },
  { id: 'tape', title: 'Market trades', home: 'bottom' },
];

export const paneTitle = (id: PaneId) => PANES.find(p => p.id === id)?.title ?? id;
