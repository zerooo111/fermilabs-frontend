/**
 * PointsShell.tsx
 * Landing chrome for the points pages. They are served on fermi.trade, so they
 * wear the landing header, frame and footer rather than the trading app's.
 */
import type { ReactNode } from 'react';
import '@/pages/home/landing.css';
import LandingHeader from '@/pages/home/ui/LandingHeader';
import { LandingFooter } from '@/pages/home/ui/LandingFooter';

export function PointsShell({ children }: { children: ReactNode }) {
  return (
    <div className="landing flex min-h-screen w-full flex-col bg-background text-rock">
      <LandingHeader />
      <main className="frame flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
}
