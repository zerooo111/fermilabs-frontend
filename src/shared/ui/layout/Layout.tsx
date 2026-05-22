import { Outlet } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Header } from './Header';

export function Layout() {
  return (
    <div className="flex flex-col min-h-screen">
      <div
        role="status"
        className="flex items-center justify-center gap-2 bg-green-500/15 border-b border-green-400/40 text-green-200 px-4 py-2 text-sm"
      >
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
        <span className="leading-snug">
          All services are back online. The earlier Pyth Network oracle disruption has been resolved
          — thanks for your patience.{' '}
          <a
            href="https://status.pyth.network"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2 hover:text-green-100"
          >
            View status
          </a>
          .
        </span>
      </div>
      <Header />
      <Outlet />
    </div>
  );
}
