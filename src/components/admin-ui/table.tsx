import * as React from 'react';
import { cn } from '@/lib/utils';

export function AdminTable({
  className,
  ...props
}: React.ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        data-slot="admin-table"
        className={cn('w-full border-collapse text-sm', className)}
        {...props}
      />
    </div>
  );
}

export function AdminTHead({
  className,
  ...props
}: React.ComponentProps<'thead'>) {
  return (
    <thead
      className={cn('bg-[#FAFAFA] text-xs font-semibold text-[#52525B]', className)}
      {...props}
    />
  );
}

export function AdminTh({
  className,
  numeric,
  ...props
}: React.ComponentProps<'th'> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        'h-10 border-b border-[#F4F4F5] px-3 text-start font-semibold',
        numeric && 'text-end tabular-nums',
        className
      )}
      {...props}
    />
  );
}

export const AdminTr = React.forwardRef<
  HTMLTableRowElement,
  React.ComponentProps<'tr'>
>(function AdminTr({ className, ...props }, ref) {
  return (
    <tr
      ref={ref}
      className={cn(
        'h-[52px] border-b border-[#F4F4F5] bg-white transition-colors hover:bg-[#FAFAFA]',
        className
      )}
      {...props}
    />
  );
});

export function AdminTd({
  className,
  numeric,
  ...props
}: React.ComponentProps<'td'> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'px-3 py-2 align-middle text-[#18181B]',
        numeric && 'text-end tabular-nums',
        className
      )}
      {...props}
    />
  );
}
