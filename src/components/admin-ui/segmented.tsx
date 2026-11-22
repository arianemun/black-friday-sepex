'use client';

import { cn } from '@/lib/utils';

export type SegmentOption<T extends string> = { id: T; label: string };

/** Compact segmented control — replaces ad-hoc `<button className>` date-range chips. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  className,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (id: T) => void;
  'aria-label': string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('flex rounded-lg bg-[#F4F4F5] p-[3px]', className)}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              'h-[30px] rounded-md px-3 text-[13px] transition-colors',
              active
                ? 'bg-white font-semibold text-[#18181B] shadow-sm'
                : 'font-medium text-[#52525B] hover:text-[#18181B]'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
