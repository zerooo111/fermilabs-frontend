import { cva } from 'class-variance-authority';

const badgeVariants = cva('inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary text-primary-foreground shadow ',
      secondary: 'border-transparent bg-secondary text-secondary-foreground ',
      outline: 'text-foreground',
      danger: 'bg-red-500/10 text-red-500 ring ring-red-500/50 ',
      success: 'bg-green-500/10 text-emerald-500 ring ring-emerald-500/50 ',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export { badgeVariants };
