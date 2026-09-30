import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col', className)} {...props} />
  );
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'text-fg-secondary inline-flex h-12 w-fit items-center justify-center',
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "h-full hover:bg-state-hover hover:text-fg-primary border-b-2 border-transparent data-[state=active]:bg-state-hover data-[state=active]:border-fg-primary data-[state=active]:text-fg-primary text-fg-tertiary inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus disabled:cursor-not-allowed disabled:bg-transparent disabled:text-fg-disabled data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer",
        className
      )}
      {...props}
    />
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
