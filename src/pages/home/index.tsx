import { lazy, Suspense } from 'react';
import './landing.css';
import LandingHeader from './ui/LandingHeader';
import HeroSection from './ui/HeroSection';
import OrderbookField from './ui/OrderbookField';
import { LandingFooter } from './ui/LandingFooter';
import NoiseOverlay from './ui/NoiseOverlay';

const FeaturesSection = lazy(() => import('./ui/FeaturesSection'));
const ExchangeSection = lazy(() => import('./ui/ExchangeSection'));
const BlogSection = lazy(() => import('./ui/BlogSection'));
const CTASection = lazy(() => import('./ui/CTASection'));

export default function HomePage() {
  return (
    <div className="landing flex min-h-screen w-full flex-col bg-dark-forest text-rock">
      <LandingHeader />
      <main>
        <HeroSection />
        <OrderbookField />
        <Suspense fallback={<div className="frame h-96" />}>
          <FeaturesSection />
          <ExchangeSection />
          <BlogSection />
          <CTASection />
        </Suspense>
      </main>
      <LandingFooter />
      <NoiseOverlay />
    </div>
  );
}
