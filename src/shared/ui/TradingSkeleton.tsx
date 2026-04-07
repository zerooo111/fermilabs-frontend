/**
 * TradingSkeleton.tsx
 * Minimal skeleton loading state that mirrors the trading terminal layout.
 */

const Bone = ({ className = '' }: { className?: string }) => (
  <div className={`skeleton-bone ${className}`} />
);

function ChartSkeleton() {
  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      {/* Chart header */}
      <div className="h-12 flex items-center gap-4 px-4 border-b border-outline">
        <Bone className="h-4 w-24" />
        <div className="hidden md:flex items-center gap-6">
          <Bone className="h-3 w-16" />
          <Bone className="h-3 w-14" />
          <Bone className="h-3 w-16" />
        </div>
      </div>
      {/* Toolbar */}
      <div className="h-8 flex items-center gap-1.5 px-2 border-b border-outline bg-card">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bone key={i} className="h-4 w-7" />
        ))}
      </div>
      {/* Chart area */}
      <div className="flex-1 min-h-[250px] md:min-h-[350px] lg:min-h-[400px]" />
    </div>
  );
}

function OrderbookSkeleton() {
  return (
    <div className="w-full lg:w-[360px] flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="h-10 flex items-center border-b border-outline px-4 gap-4">
        <Bone className="h-3.5 w-16" />
        <Bone className="h-3.5 w-12" />
      </div>
      {/* Column headers */}
      <div className="grid grid-cols-3 px-4 py-2 bg-card border-b border-outline">
        <Bone className="h-2.5 w-8" />
        <Bone className="h-2.5 w-6 justify-self-end" />
        <Bone className="h-2.5 w-8 justify-self-end" />
      </div>
      {/* Rows */}
      <div className="flex flex-col">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="grid grid-cols-3 gap-4 items-center px-4 h-[26px]">
            <Bone className="h-2.5 w-14" />
            <Bone className="h-2.5 w-10 justify-self-end" />
            <Bone className="h-2.5 w-12 justify-self-end" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TradePanelSkeleton() {
  return (
    <div className="flex flex-col w-full lg:w-xs overflow-hidden">
      {/* Tabs */}
      <div className="h-10 flex items-center border-b border-outline px-4 gap-4">
        <Bone className="h-3.5 w-10" />
        <Bone className="h-3.5 w-12" />
      </div>
      <div className="p-3 flex flex-col gap-3">
        {/* Inputs */}
        <div className="h-10 rounded border border-outline" />
        <div className="h-10 rounded border border-outline" />
        {/* Leverage presets */}
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 flex-1 rounded border border-outline" />
          ))}
        </div>
        {/* Slider */}
        <div className="h-1 rounded-full bg-white/[0.06]" />
        {/* Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="h-10 rounded border border-outline" />
          <div className="h-10 rounded border border-outline" />
        </div>
      </div>
    </div>
  );
}

function PortfolioSkeleton() {
  return (
    <div className="flex flex-col md:flex-row flex-1 h-full mx-2 md:mx-4 border-x border-outline divide-y md:divide-y-0 md:divide-x divide-outline overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-12 flex items-center gap-4 px-4 bg-card border-b border-outline">
          <Bone className="h-3.5 w-16" />
          <Bone className="h-3.5 w-16" />
          <Bone className="h-3.5 w-14" />
        </div>
      </div>
      <div className="w-full md:w-80 flex-shrink-0 flex flex-col overflow-hidden">
        <div className="h-12 flex items-center px-4 bg-card border-b border-outline">
          <Bone className="h-3.5 w-16" />
        </div>
        <div className="flex flex-col gap-2.5 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Bone className="h-2.5 w-20" />
              <Bone className="h-2.5 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TradingSkeleton() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)]">
      <div className="flex flex-col lg:flex-row mx-2 md:mx-4 border-x border-outline divide-y lg:divide-y-0 lg:divide-x divide-outline">
        <ChartSkeleton />
        <OrderbookSkeleton />
        <TradePanelSkeleton />
      </div>
      <div className="flex-1 flex flex-col border-t border-outline overflow-hidden">
        <PortfolioSkeleton />
      </div>
    </div>
  );
}
