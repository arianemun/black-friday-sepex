import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="admin-empty-state"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className
      )}
    >
      {icon ? (
        <div className="flex size-10 items-center justify-center rounded-full bg-[#F4F4F5] text-[#71717A] [&_svg]:size-5">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="text-[15px] font-semibold text-[#18181B]">{title}</p>
        {hint ? <p className="text-[13px] text-[#71717A]">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}
