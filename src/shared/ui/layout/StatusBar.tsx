import { useAtomValue } from 'jotai';
import { cn } from '@/lib/utils';
import { sseConnectionStateAtom } from '@/shared/api/sse-atoms';
import { useGatewayLatency } from '@/shared/hooks/useGatewayLatency';
import { config } from '@/shared/config/constants';
import { LINKS } from '@/shared/config/links';

const CONNECTION = {
  connected: { dot: 'bg-success', label: 'Connected' },
  connecting: { dot: 'bg-amber-200 animate-pulse', label: 'Connecting' },
  reconnecting: { dot: 'bg-amber-200 animate-pulse', label: 'Reconnecting' },
  disconnected: { dot: 'bg-danger', label: 'Offline' },
} as const;

function getNetwork(rpcUrl: string): { label: string; className: string } {
  if (rpcUrl.includes('mainnet')) return { label: 'Mainnet', className: 'text-success' };
  if (rpcUrl.includes('devnet')) return { label: 'Devnet', className: 'text-amber-200' };
  if (rpcUrl.includes('testnet')) return { label: 'Testnet', className: 'text-lichen' };
  return { label: 'Custom', className: 'text-rock/60' };
}

function latencyClass(ms: number): string {
  if (ms < 150) return 'text-success';
  if (ms < 400) return 'text-amber-200';
  return 'text-danger';
}

const STATUS_LINKS = [
  { label: 'Docs', href: LINKS.DOCS },
  { label: 'Discord', href: LINKS.DISCORD },
  { label: 'X', href: LINKS.TWITTER },
];

/** Fixed bottom strip: live connection health on the left, links and build on the right. */
export function StatusBar() {
  const state = useAtomValue(sseConnectionStateAtom);
  const latency = useGatewayLatency();
  const connection = CONNECTION[state];
  const network = getNetwork(config.devnet.rpcUrl);

  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 flex h-6 items-center justify-between border-t border-outline bg-background px-2 font-mono text-[11px] text-rock/50 md:px-4">
      <div className="flex items-center divide-x divide-outline">
        <span className="flex items-center gap-1.5 pr-3" title="Market data stream">
          <span className={cn('size-1.5 rounded-full', connection.dot)} />
          {connection.label}
        </span>
        <span className="px-3 tabular-nums" title="Round-trip time to the gateway">
          {latency === null ? (
            '–'
          ) : (
            <span className={latencyClass(latency)}>{Math.round(latency)}ms</span>
          )}
        </span>
        <span className={cn('px-3', network.className)}>{network.label}</span>
      </div>
      <div className="hidden items-center gap-3 md:flex">
        {STATUS_LINKS.map(link => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-150 hover:text-rock"
          >
            {link.label}
          </a>
        ))}
        <span className="border-l border-outline pl-3 text-rock/30" title="Build">
          {__BUILD_ID__.split('-')[0]}
        </span>
      </div>
    </footer>
  );
}
