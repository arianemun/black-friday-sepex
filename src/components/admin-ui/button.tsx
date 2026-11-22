import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const adminButtonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-[#DBEAFE] focus-visible:border-[#2563EB] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-[#18181B] text-white hover:bg-[#27272A] border border-transparent',
        secondary:
          'bg-white text-[#18181B] border border-[#E4E4E7] hover:bg-[#FAFAFA]',
        ghost: 'bg-transparent text-[#18181B] border border-transparent hover:bg-[#F4F4F5]',
        destructive: 'bg-[#DC2626] text-white border border-transparent hover:bg-[#B91C1C]',
        link: 'bg-transparent border-transparent text-[#2563EB] font-semibold hover:underline underline-offset-4 px-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-[38px] px-4 text-sm',
        lg: 'h-11 px-5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export type AdminButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof adminButtonVariants> & {
    loading?: boolean;
    icon?: React.ReactNode;
  };

export function Button({
  className,
  variant,
  size,
  loading = false,
  icon,
  children,
  disabled,
  ...props
}: AdminButtonProps) {
  return (
    <button
      type="button"
      data-slot="admin-button"
      data-variant={variant ?? 'primary'}
      className={cn(adminButtonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export { adminButtonVariants };
