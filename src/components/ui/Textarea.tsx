import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Textarea({
  label,
  error,
  helperText,
  className,
  id,
  rows = 4,
  ...props
}: TextareaProps) {
  const textareaId = id || props.name;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textareaId} className="mb-1.5 block text-sm font-medium text-neutral-700">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        className={cn(
          'w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 transition-colors',
          'placeholder:text-neutral-400',
          'focus:border-primary-500 focus:ring-1 focus:ring-primary-500',
          error
            ? 'border-error-400 focus:border-error-500 focus:ring-error-500'
            : 'border-neutral-300',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1.5 text-sm text-error-600">{error}</p>}
      {helperText && !error && <p className="mt-1.5 text-sm text-neutral-500">{helperText}</p>}
    </div>
  );
}
