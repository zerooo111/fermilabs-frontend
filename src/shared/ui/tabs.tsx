import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';
import { TabActive, TabHover, TabStrip, useTabStripItem, useTabStripReset } from './tab-strip';

/**
 * Tabs mirror the selected value into a TabStrip context so triggers can
 * draw the shared hover pill and the sliding active line.
 */
function Tabs({
  className,
  value,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const [inner, setInner] = React.useState(defaultValue ?? '');
  const current = value ?? inner;
  return (
    <TabStrip active={current} className={cn('flex flex-col', className)}>
      <TabsPrimitive.Root
        data-slot="tabs"
        className="contents"
        value={current}
        onValueChange={v => {
          setInner(v);
          onValueChange?.(v);
        }}
        {...props}
      />
    </TabStrip>
  );
}

function TabsList({
  className,
  onMouseLeave,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const reset = useTabStripReset();
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn('text-rock inline-flex h-8 w-fit items-center justify-start', className)}
      onMouseLeave={e => {
        reset();
        onMouseLeave?.(e);
      }}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  value,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const item = useTabStripItem(value);
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      value={value}
      className={cn(
        "relative isolate h-full -mb-px text-rock/50 hover:text-rock/85 data-[state=active]:text-rock inline-flex items-center justify-center gap-1.5 px-3 text-xs tracking-[0.01em] whitespace-nowrap transition-colors duration-150 outline-none focus-visible:outline-2 focus-visible:outline-amber-200 focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-25 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer",
        className
      )}
      {...item.bind}
      {...props}
    >
      <TabHover show={item.isHovered} stripId={item.stripId} />
      <TabActive show={item.isActive} stripId={item.stripId} />
      {children}
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none ', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
