import { lazy, Suspense } from 'react';
import LandingHeader from './ui/LandingHeader';
import HeroSection from './ui/HeroSection';
import { LandingFooter } from './ui/LandingFooter';
import NoiseOverlay from './ui/NoiseOverlay';
import CTASection from './ui/CTASection';
import BlogSection from './ui/BlogSection';

const FeaturesSection = lazy(() => import('./ui/FeaturesSection'));

export default function HomePage() {
  return (
    <div
      data-surface="brand"
      className="w-screen flex flex-col items-center bg-surface-brand text-fg-primary font-[Arimo]"
    >
      <LandingHeader />
      <main className="md:border-x border-line-on-brand flex-col gap-20 md:gap-40 container-2xl justify-center items-center">
        <HeroSection />
        <Suspense
          fallback={
            <div className="h-96 flex items-center justify-center text-fg-secondary">
              Loading features...
            </div>
          }
        >
          <FeaturesSection />
        </Suspense>
        <BlogSection />
        <CTASection />
      </main>
      <LandingFooter />
      <NoiseOverlay />
    </div>
  );
}
