/**
 * PointsShell.tsx
 * Landing chrome for the points pages. They are served on fermi.trade, so they
 * wear the landing header, frame and footer rather than the trading app's, but
 * on the trading app's darker background: the points pages are dense with
 * small secondary text, which the landing green can't carry at AA contrast.
 * No film grain either: its soft-light blend crushes that background to black.
 */
import type { ReactNode } from 'react';
import '@/pages/home/landing.css';
import LandingHeader from '@/pages/home/ui/LandingHeader';
import { LandingFooter } from '@/pages/home/ui/LandingFooter';
import './points-theme.css';

export function PointsShell({ children }: { children: ReactNode }) {
  return (
    <div className="landing points-theme flex min-h-screen w-full flex-col bg-background text-rock">
      <LandingHeader />
      <main className="frame flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
}
