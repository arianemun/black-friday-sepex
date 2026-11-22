import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const adminBadgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold leading-none',
  {
    variants: {
      variant: {
        neutral: 'bg-[#F4F4F5] border-[#E4E4E7] text-[#3F3F46]',
        success: 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]',
        warning: 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]',
        danger: 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]',
        info: 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8]',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
);

export type AdminBadgeProps = ComponentProps<'span'> &
  VariantProps<typeof adminBadgeVariants>;

export function Badge({ className, variant, ...props }: AdminBadgeProps) {
  return (
    <span
      data-slot="admin-badge"
      className={cn(adminBadgeVariants({ variant }), className)}
      {...props}
    />
  );
}

type BadgeVariant = NonNullable<VariantProps<typeof adminBadgeVariants>['variant']>;

/** Request status → badge variant. */
export function requestStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'new':
      return 'warning';
    case 'contacted':
    case 'reviewing':
      return 'info';
    case 'quoted':
      return 'info';
    case 'ordered':
      return 'success';
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

export { adminBadgeVariants };
