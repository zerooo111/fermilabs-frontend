/**
 * What the vault holds on Fermi: perp positions with their unsettled PnL,
 * resting orders (price and size from the market route), and collateral and
 * health. All indicative: the portfolio isn't a deposit or redemption price.
 */
import type { PublicKey } from '@solana/web3.js';

import { cn } from '@/lib/utils';

import type { FlpEnvelope, FlpPosition } from '../model/api';
import { FLP_MARKET_BASE_DECIMALS } from '../model/config';
import { fixedScaled, fixedToNative, formatSigned, formatUnits } from '../model/format';
import { useFlpOrders } from '../model/useFlpVault';
import { portfolioOf, portfolioUnavailable } from '../model/view';
import { Bone, Panel, Row } from './primitives';

const HEALTH_INFINITE = 10n ** 12n;

export function Portfolio({ vault, envelope }: { vault: PublicKey; envelope?: FlpEnvelope }) {
  const portfolio = envelope ? portfolioOf(envelope) : null;
  const missing = envelope ? portfolioUnavailable(envelope) : null;
  const { orders, loading } = useFlpOrders(vault, envelope);
  const qd = envelope?.data.units.quoteDecimals ?? 6;
  const names = new Map(portfolio?.positions.map(p => [p.marketIndex, p]) ?? []);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
      <div className="space-y-5">
        <Panel title="Positions" aside={<Note>indicative</Note>}>
          {!envelope ? (
            <Skeleton />
          ) : !portfolio ? (
            <p className="px-4 py-4 text-xs text-rock/45">{missing}</p>
          ) : !portfolio.positions.length ? (
            <p className="px-4 py-4 text-xs text-rock/45">
              No active perp markets. The vault holds only USDC.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-xs">
                <thead>
                  <tr className="border-b border-outline text-left font-mono text-[10px] uppercase tracking-[0.12em] text-rock/45">
                    <th className="px-4 py-2 font-normal">Market</th>
                    <Th>Size</Th>
                    <Th>Oracle</Th>
                    <Th>Exposure</Th>
                    <Th>Unsettled PnL</Th>
                    <Th>Funding</Th>
                    <Th>Resting</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline">
                  {portfolio.positions.map(p => (
                    <PositionRow key={p.marketIndex} p={p} qd={qd} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Open orders">
          {!envelope || (loading && !orders.length) ? (
            <Skeleton />
          ) : !orders.length ? (
            <p className="px-4 py-4 text-xs text-rock/45">
              No resting orders. The devnet market maker quotes only during test runs.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-xs">
                <thead>
                  <tr className="border-b border-outline text-left font-mono text-[10px] uppercase tracking-[0.12em] text-rock/45">
                    <th className="px-4 py-2 font-normal">Market</th>
                    <Th>Side</Th>
                    <Th>Price</Th>
                    <Th>Size</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline">
                  {orders.map((o, i) => {
                    const p = names.get(o.marketIndex);
                    const bd = FLP_MARKET_BASE_DECIMALS[o.marketIndex] ?? qd;
                    const baseLot = BigInt(p?.baseLotSize ?? '1');
                    const quoteLot = BigInt(p?.quoteLotSize ?? '1');
                    // price_lots × quote lot / base lot is native quote per native base.
                    const price = (BigInt(o.price_lots) * quoteLot * 10n ** BigInt(bd)) / baseLot;
                    const bid = /bid|buy/i.test(o.side);
                    return (
                      <tr key={`${o.marketIndex}-${o.client_order_id ?? i}`}>
                        <td className="px-4 py-2 font-mono text-rock/85">
                          {p?.name ?? `Market ${o.marketIndex}`}
                        </td>
                        <Td className={bid ? 'text-success' : 'text-danger'}>
                          {bid ? 'Bid' : 'Ask'}
                        </Td>
                        <Td>{formatUnits(price, qd, 4)}</Td>
                        <Td>{formatUnits(BigInt(o.base_lots) * baseLot, bd, 4)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Collateral and health">
        {!envelope ? (
          <Skeleton />
        ) : !portfolio ? (
          <p className="px-4 py-4 text-xs text-rock/45">{missing}</p>
        ) : (
          <>
            <dl className="divide-y divide-outline">
              {portfolio.collateral.map(c => (
                <Row
                  key={c.tokenIndex}
                  label={c.tokenIndex === 0 ? 'USDC collateral' : `Token ${c.tokenIndex}`}
                >
                  {formatUnits(fixedToNative(c.balanceNative), c.decimals, 2)}
                </Row>
              ))}
              <Row label="Unsettled perp PnL" hint="Not withdrawable USDC until settled">
                {formatSigned(fixedToNative(portfolio.valuation.unsettledPerpQuoteNative), qd, 2)}
              </Row>
              <Row label="Indicative NAV">
                {formatUnits(fixedToNative(portfolio.valuation.indicativeNavQuoteNative), qd, 2)}
              </Row>
              <Row label="Init health">
                {formatUnits(fixedToNative(portfolio.health.initReferenceNative), qd, 2)}
              </Row>
              <Row label="Maint health">
                {formatUnits(fixedToNative(portfolio.health.maintReferenceNative), qd, 2)}
              </Row>
              <Row label="Init health ratio">{healthRatio(portfolio.health.initRatioPercent)}</Row>
            </dl>
            {portfolio.warnings.length > 0 && (
              <ul className="space-y-1 border-t border-outline px-4 py-3 text-[11px] leading-snug text-rock/40">
                {portfolio.warnings.map(w => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

function PositionRow({ p, qd }: { p: FlpPosition; qd: number }) {
  const bd = FLP_MARKET_BASE_DECIMALS[p.marketIndex] ?? qd;
  const lots = BigInt(p.baseLots);
  const size = lots * BigInt(p.baseLotSize);
  const pnl = fixedToNative(p.unsettledPnlSettlementNative);
  const flat = lots === 0n;
  return (
    <tr className={cn(flat && 'text-rock/45')}>
      <td className="px-4 py-2 font-mono text-rock/85">{p.name}</td>
      <Td className={flat ? undefined : lots > 0n ? 'text-success' : 'text-danger'}>
        {flat
          ? '0'
          : `${lots > 0n ? 'Long' : 'Short'} ${formatUnits(size < 0n ? -size : size, bd, 4)}`}
      </Td>
      <Td>{formatUnits(fixedScaled(p.oraclePriceSettlementNativePerBaseNative, bd), qd, 4)}</Td>
      <Td>{formatSigned(fixedToNative(p.signedExposureSettlementNative), qd, 2)}</Td>
      <Td className={pnl > 0n ? 'text-success' : pnl < 0n ? 'text-danger' : undefined}>
        {formatSigned(pnl, qd, 2)}
      </Td>
      <Td>{formatSigned(fixedToNative(p.unsettledFundingNative), qd, 2)}</Td>
      <Td>
        {p.bidsBaseLots === '0' && p.asksBaseLots === '0'
          ? '—'
          : `${p.bidsBaseLots} / ${p.asksBaseLots} lots`}
      </Td>
    </tr>
  );
}

function healthRatio(v: { raw: string; fractionalBits: number }): string {
  // A vault with no liabilities reports i128::MAX: show it as unbounded.
  const pct = fixedToNative(v);
  return pct > HEALTH_INFINITE ? '∞' : `${pct.toLocaleString('en-US')}%`;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-right font-normal">{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn('px-3 py-2 text-right font-mono tabular-nums', className)}>{children}</td>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[10px] text-rock/35">{children}</span>;
}

function Skeleton() {
  return (
    <div className="space-y-2 p-4">
      <Bone className="h-4 w-full" />
      <Bone className="h-4 w-3/4" />
    </div>
  );
}
