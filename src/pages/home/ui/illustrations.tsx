// Blueprint line drawings for the landing page cards, styled by `.bp` in
// landing.css. Motion is plain CSS keyframes (the `a-*` classes) that only run
// while the drawing is on screen.

import type { CSSProperties } from 'react';
import { useInView } from '../lib/useInView';

function Blueprint({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useInView<SVGSVGElement>();
  return (
    <div className="blueprint border border-rock/15 p-4 md:p-6">
      <svg
        ref={ref}
        className="bp bp-anim h-auto w-full overflow-visible"
        viewBox="0 0 320 160"
        role="img"
        aria-label={label}
      >
        {children}
      </svg>
    </div>
  );
}

const pulse = (dx: number, dy: number, delay = 0) =>
  ({ '--dx': `${dx}px`, '--dy': `${dy}px`, '--delay': `${delay}s` }) as CSSProperties;

const QUEUE = [236, 208, 180, 152, 124, 96, 68];

export function FairQueueDrawing() {
  return (
    <Blueprint label="Orders fill strictly in arrival order; a front-runner is blocked from cutting the line">
      <line x1="250" y1="40" x2="250" y2="120" className="accent" />
      <text x="250" y="32" textAnchor="middle">
        match
      </text>
      <g className="a-queue">
        {QUEUE.map((x, i) => (
          <rect
            key={x}
            x={x - 8}
            y={72}
            width={16}
            height={16}
            className={i === 0 ? 'fill a-leave' : 'accent'}
          />
        ))}
        <rect x={32} y={72} width={16} height={16} className="accent a-join" />
      </g>
      <line x1="150" y1="62" x2="210" y2="62" className="amber" />
      <g className="a-cutter">
        <rect x={172} y={24} width={16} height={16} className="amber dash" />
      </g>
      <g className="a-block">
        <path d="M216 44 l10 10 M226 44 l-10 10" className="amber" />
      </g>
      <text x="180" y="14" textAnchor="middle">
        front-run
      </text>
      <text x="138" y="65" textAnchor="end" opacity="0.7">
        no mempool
      </text>
      <line x1="40" y1="108" x2="236" y2="108" className="soft" />
      <polyline points="231,104 236,108 231,112" className="soft" />
      <text x="138" y="130" textAnchor="middle">
        price-time priority
      </text>
    </Blueprint>
  );
}

export function FinalityDrawing() {
  return (
    <Blueprint label="A Fermi trade confirms the moment it lands; a block-based trade waits for its slot">
      <line x1="40" y1="140" x2="296" y2="140" className="soft" />
      <text x="296" y="154" textAnchor="end">
        time
      </text>
      {[100, 160, 220].map(x => (
        <line key={x} x1={x} y1="88" x2={x} y2="112" className="soft" />
      ))}
      <text x="160" y="126" textAnchor="middle" opacity="0.7">
        slots
      </text>

      <text x="20" y="53">
        fermi
      </text>
      <circle cx="62" cy="50" r="3" className="fill-rock" />
      <g className="a-confirm-now">
        <rect x="72" y="42" width="16" height="16" className="accent" />
        <path d="M76 50 l3 3 l6 -6" className="accent" />
        <text x="96" y="53" className="hi">
          confirmed
        </text>
      </g>

      <text x="20" y="103">
        blocks
      </text>
      <circle cx="62" cy="100" r="3" className="fill-rock" />
      <line x1="66" y1="100" x2="230" y2="100" className="soft a-wait" />
      <g className="a-confirm-late">
        <rect x="232" y="92" width="16" height="16" />
        <path d="M236 100 l3 3 l6 -6" />
        <text x="254" y="103">
          included
        </text>
      </g>

      <g className="a-playhead">
        <line x1="62" y1="30" x2="62" y2="140" className="amber" />
      </g>
    </Blueprint>
  );
}

export function SequencingDrawing() {
  const inputs = [
    { y: 24, label: 'rollup' },
    { y: 69, label: 'app' },
    { y: 114, label: 'dex' },
  ];
  return (
    <Blueprint label="Rollups and apps feed one sequencer that emits an ordered log and settles in batches">
      <defs>
        <clipPath id="seq-log-clip">
          <rect x="207" y="69" width="98" height="22" />
        </clipPath>
      </defs>
      {inputs.map(({ y, label }) => (
        <g key={label}>
          <rect x="20" y={y} width="56" height="22" />
          <text x="48" y={y + 15} textAnchor="middle">
            {label}
          </text>
          <line x1="76" y1={y + 11} x2="130" y2="80" className="accent a-flow" />
        </g>
      ))}
      <rect x="130" y="40" width="60" height="80" className="accent" />
      <text x="160" y="84" textAnchor="middle">
        continuum
      </text>
      <line x1="190" y1="80" x2="206" y2="80" className="accent a-flow" />

      <text x="206" y="60">
        ordered log
      </text>
      <rect x="206" y="68" width="100" height="24" className="soft" />
      <g clipPath="url(#seq-log-clip)">
        <g className="a-log">
          {[191, 210, 229, 248, 267, 286].map(x => (
            <rect key={x} x={x} y="75" width="10" height="10" className="fill" />
          ))}
        </g>
      </g>
      <line x1="256" y1="92" x2="256" y2="128" className="a-flow" />
      <polyline points="252,123 256,128 260,123" />
      <text x="256" y="146" textAnchor="middle">
        batch settle on solana
      </text>
    </Blueprint>
  );
}

export function LiquidityDrawing() {
  return (
    <Blueprint label="Lending, a market-making vault and the exchange draw on one shared liquidity layer">
      <line x1="88" y1="30" x2="120" y2="66" className="soft" />
      <line x1="88" y1="130" x2="120" y2="94" className="soft" />
      <line x1="200" y1="80" x2="232" y2="80" className="soft" />

      <rect x="120" y="58" width="80" height="44" className="accent a-breathe" />
      <text x="160" y="77" textAnchor="middle">
        shared
      </text>
      <text x="160" y="91" textAnchor="middle">
        liquidity
      </text>

      <rect x="16" y="18" width="72" height="24" />
      <text x="52" y="34" textAnchor="middle">
        lending
      </text>
      <rect x="16" y="118" width="72" height="24" />
      <text x="52" y="134" textAnchor="middle">
        mm vault
      </text>
      <rect x="232" y="68" width="72" height="24" />
      <text x="268" y="84" textAnchor="middle">
        exchange
      </text>

      <circle cx="88" cy="30" r="2.5" className="fill a-pulse" style={pulse(32, 36)} />
      <circle cx="120" cy="94" r="2.5" className="fill a-pulse" style={pulse(-32, 36, 0.5)} />
      <circle cx="200" cy="80" r="2.5" className="fill-amber a-pulse" style={pulse(32, 0, 1)} />
      <circle cx="232" cy="80" r="2.5" className="fill a-pulse" style={pulse(-32, 0, 0.25)} />
    </Blueprint>
  );
}

export function RoadmapDrawing() {
  return (
    <Blueprint label="A stepped roadmap climbing from today's onchain markets to NASDAQ-grade market structure">
      <line x1="30" y1="140" x2="296" y2="140" className="soft" />
      <line x1="30" y1="20" x2="30" y2="140" className="soft" />
      <polyline
        points="30,130 90,130 90,104 150,104 150,78 210,78 210,52 270,52 270,34 296,34"
        className="accent a-draw"
      />
      {[
        [90, 130],
        [150, 104],
        [210, 78],
        [270, 52],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="3" className="fill" />
      ))}
      <circle cx="296" cy="34" r="3" className="fill-amber a-blink" />
      <text x="34" y="154">
        today
      </text>
      <text x="296" y="24" textAnchor="end" className="hi">
        nasdaq-grade
      </text>
      <text x="164" y="126" textAnchor="middle" opacity="0.7">
        no trusted intermediaries
      </text>
    </Blueprint>
  );
}

const XS = [30, 95, 160, 225, 290];
const line = (ys: number[]) => XS.map((x, i) => `${x},${ys[i]}`).join(' ');

export function MarketShareDrawing() {
  return (
    <Blueprint label="Stacked share of trading volume by venue type: order books, auctions, dark pools and OTC">
      <line x1="30" y1="20" x2="30" y2="130" className="soft" />
      <text x="24" y="24" textAnchor="end">
        100%
      </text>
      <text x="24" y="133" textAnchor="end">
        0
      </text>
      <polyline points={line([130, 130, 130, 130, 130])} className="soft" />
      <polyline points={line([70, 76, 88, 84, 92])} className="accent a-draw" />
      <polyline points={line([52, 56, 64, 66, 72])} className="a-draw" />
      <polyline points={line([40, 42, 46, 50, 54])} className="a-draw" />
      <polyline points={line([20, 20, 20, 20, 20])} className="soft" />
      <text x="40" y="112" className="hi">
        clob
      </text>
      <text x="40" y="68">
        auction
      </text>
      <text x="40" y="51" opacity="0.8">
        dark
      </text>
      <text x="40" y="34" opacity="0.8">
        otc
      </text>
      <text x="290" y="150" textAnchor="end">
        share of volume
      </text>
    </Blueprint>
  );
}

export function FifoPerpsDrawing() {
  return (
    <Blueprint label="Orders queue first in, first out into a perps matching engine that opens positions and settles on Solana">
      <defs>
        <clipPath id="fifo-in-clip">
          <rect x="14" y="60" width="100" height="40" />
        </clipPath>
      </defs>
      <text x="20" y="50">
        arrivals
      </text>
      <g clipPath="url(#fifo-in-clip)">
        <g className="a-queue">
          {[-12, 16, 44, 72, 100].map((x, i) => (
            <g key={x}>
              <rect x={x} y="72" width="16" height="16" className={i === 3 ? 'fill' : 'accent'} />
            </g>
          ))}
        </g>
      </g>
      <line x1="116" y1="80" x2="134" y2="80" className="accent a-flow" />
      <rect x="134" y="52" width="72" height="56" className="accent" />
      <text x="170" y="77" textAnchor="middle">
        fifo
      </text>
      <text x="170" y="91" textAnchor="middle">
        matching
      </text>
      <line x1="206" y1="70" x2="232" y2="62" className="a-flow" />
      <line x1="206" y1="90" x2="232" y2="98" className="a-flow" />
      <text x="236" y="50">
        positions
      </text>
      <rect x="236" y="54" width="68" height="16" />
      <text x="242" y="66" className="hi">
        long 25
      </text>
      <rect x="236" y="90" width="68" height="16" />
      <text x="242" y="102">
        short 40
      </text>
      <line x1="170" y1="108" x2="170" y2="130" className="a-flow" />
      <polyline points="166,125 170,130 174,125" />
      <text x="170" y="146" textAnchor="middle">
        settles on solana
      </text>
    </Blueprint>
  );
}

export function ProofOfSequenceDrawing() {
  const blocks = [20, 98, 176, 254];
  return (
    <Blueprint label="Transactions linked by hashes into a provable sequence">
      <line x1="20" y1="34" x2="306" y2="34" className="soft" />
      {blocks.map((x, i) => (
        <g key={x}>
          <line x1={x + 26} y1="30" x2={x + 26} y2="38" className="soft" />
          <text x={x + 26} y="24" textAnchor="middle">
            t{i}
          </text>
          <rect x={x} y="52" width="52" height="40" className={i === 3 ? 'accent a-breathe' : ''} />
          <text x={x + 26} y="70" textAnchor="middle">
            tx {i}
          </text>
          <text x={x + 26} y="84" textAnchor="middle" opacity="0.7">
            {i === 0 ? 'genesis' : `h(tx ${i - 1})`}
          </text>
          {i < 3 && (
            <>
              <line x1={x + 52} y1="72" x2={x + 78} y2="72" className="accent a-flow" />
              <polyline points={`${x + 73},68 ${x + 78},72 ${x + 73},76`} />
            </>
          )}
        </g>
      ))}
      <path d="M20 110 v6 h286 v-6" className="dash" />
      <text x="163" y="134" textAnchor="middle">
        proof of sequence
      </text>
    </Blueprint>
  );
}

export function ContinuumDrawing() {
  return (
    <Blueprint label="TradFi market structure and DeFi's open, verifiable settlement converge on one chain built for trading">
      <defs>
        <clipPath id="cont-chain-clip">
          <rect x="176" y="66" width="130" height="28" />
        </clipPath>
      </defs>
      <text x="20" y="38">
        tradfi
      </text>
      <text x="20" y="52" opacity="0.7">
        fifo, low latency
      </text>
      <path d="M20 60 H110 C140 60 140 80 170 80" className="accent a-flow" />
      <text x="20" y="116">
        defi
      </text>
      <text x="20" y="130" opacity="0.7">
        open, verifiable
      </text>
      <path d="M20 100 H110 C140 100 140 80 170 80" className="a-flow" />
      <rect x="170" y="62" width="136" height="36" className="soft" />
      <g clipPath="url(#cont-chain-clip)">
        <g className="a-log">
          {[157, 176, 195, 214, 233, 252, 271, 290].map(x => (
            <rect key={x} x={x + 6} y="75" width="10" height="10" className="fill" />
          ))}
        </g>
      </g>
      <text x="238" y="54" textAnchor="middle">
        continuum
      </text>
      <text x="238" y="120" textAnchor="middle" opacity="0.7">
        the blockchain for trading
      </text>
    </Blueprint>
  );
}
