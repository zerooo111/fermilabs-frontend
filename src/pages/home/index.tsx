import { lazy, Suspense } from 'react';
import LandingHeader from './ui/LandingHeader';
import HeroSection from './ui/HeroSection';
import { LandingFooter } from './ui/LandingFooter';
import NoiseOverlay from './ui/NoiseOverlay';
import CTASection from './ui/CTASection';

const FeaturesSection = lazy(() => import('./ui/FeaturesSection'));

export default function HomePage() {
  return (
    <div className="w-screen flex flex-col items-center bg-dark-forest text-rock font-[Arimo]">
      <LandingHeader />
      <main className="md:border-x border-rock/20 flex-col gap-20 md:gap-40 container-2xl justify-center items-center">
        <HeroSection />
        <Suspense
          fallback={
            <div className="h-96 flex items-center justify-center text-rock/60">
              Loading features...
            </div>
          }
        >
          <FeaturesSection />
        </Suspense>
        <CTASection />
      </main>
      <LandingFooter />
      <NoiseOverlay />
    </div>
  );
}
