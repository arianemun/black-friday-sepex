import * as React from 'react';
import { cn } from '@/lib/utils';

export function FormField({
  className,
  label,
  htmlFor,
  helper,
  error,
  children,
}: {
  className?: string;
  label: string;
  htmlFor?: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-[13px] font-semibold text-[#18181B]"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-[#B91C1C]">
          {error}
        </p>
      ) : helper ? (
        <p className="text-xs text-[#71717A]">{helper}</p>
      ) : null}
    </div>
  );
}

export const fieldControlClass =
  'h-[38px] w-full rounded-lg border border-[#E4E4E7] bg-white px-3 text-sm text-[#18181B] outline-none transition-[border,box-shadow] placeholder:text-[#A1A1AA] focus:border-[#2563EB] focus:shadow-[0_0_0_3px_#DBEAFE] disabled:opacity-50';

export const fieldTextareaClass =
  'min-h-[88px] w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-sm text-[#18181B] outline-none transition-[border,box-shadow] placeholder:text-[#A1A1AA] focus:border-[#2563EB] focus:shadow-[0_0_0_3px_#DBEAFE] disabled:opacity-50';

export function FormGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', className)}>
      {children}
    </div>
  );
}

export function FieldInput({
  className,
  ...props
}: React.ComponentProps<'input'>) {
  return <input className={cn(fieldControlClass, className)} {...props} />;
}

export function FieldTextarea({
  className,
  ...props
}: React.ComponentProps<'textarea'>) {
  return <textarea className={cn(fieldTextareaClass, className)} {...props} />;
}
