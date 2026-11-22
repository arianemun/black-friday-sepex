import * as React from 'react';
import { cn } from '@/lib/utils';

export type IconButtonProps = React.ComponentProps<'button'> & {
  'aria-label': string;
  tooltip?: string;
  variant?: 'ghost' | 'secondary' | 'destructive';
};

const variantCls = {
  ghost: 'hover:bg-[#F4F4F5] text-[#52525B]',
  secondary: 'border border-[#E4E4E7] bg-white hover:bg-[#FAFAFA] text-[#18181B]',
  destructive: 'hover:bg-[#FEF2F2] text-[#B91C1C]',
} as const;

/** Spinex admin icon button (tooltip shown as a native title). */
export function IconButton({ className, tooltip, variant = 'ghost', children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      data-slot="admin-icon-button"
      title={tooltip}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-[#DBEAFE] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
        variantCls[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
