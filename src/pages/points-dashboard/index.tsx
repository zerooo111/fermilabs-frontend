/**
 * The connected wallet's points dashboard, in the trading app's frame. A thin
 * page around the `PointsDashboard` feature.
 */
import { PointsDashboard } from '@/features/points';

function PointsDashboardPage() {
  return (
    <div className="flex min-h-[calc(100vh-60px)] flex-col px-3 py-6 md:px-6 md:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <PointsDashboard />
      </div>
    </div>
  );
}

export default PointsDashboardPage;
