/**
 * TriggerFacts.tsx
 * Label/value rows explaining how TP/SL legs behave, for tooltips.
 */
import { TRIGGER_EXPIRY_DAYS, TRIGGER_SLIPPAGE_BPS } from '../lib/display';

export function TriggerFacts({ walletSigns = false }: { walletSigns?: boolean }) {
  const rows: [string, string][] = [
    ['Triggers on', 'Oracle price, ≤1 min lag'],
    ['Max slippage', `${TRIGGER_SLIPPAGE_BPS / 100}%, else skipped`],
    ['Expires', `${TRIGGER_EXPIRY_DAYS} days`],
  ];
  if (walletSigns) rows.push(['Signing', 'Wallet, after the order']);

  return (
    <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-rock/60">{label}</dt>
          <dd className="text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
