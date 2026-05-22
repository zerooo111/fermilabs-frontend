import { Outlet } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Header } from './Header';

export function Layout() {
  return (
    <div className="flex flex-col min-h-screen">
      <div
        role="alert"
        className="flex items-center justify-center gap-2 bg-amber-500/15 border-b border-amber-400/40 text-amber-200 px-4 py-2 text-sm"
      >
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        <span className="leading-snug">
          Pyth Network oracle is currently down. Some features may be unavailable.{' '}
          <a
            href="https://status.pyth.network"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2 hover:text-amber-100"
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
