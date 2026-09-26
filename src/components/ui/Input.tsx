import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
}

export function Input({
  label,
  error,
  helperText,
  leftIcon,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id || props.name;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-neutral-700">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={cn(
            'h-10 w-full rounded-lg border bg-white px-3 text-sm text-neutral-900 transition-colors',
            'placeholder:text-neutral-400',
            'focus:border-primary-500 focus:ring-1 focus:ring-primary-500',
            leftIcon ? 'pl-10' : undefined,
            error
              ? 'border-error-400 focus:border-error-500 focus:ring-error-500'
              : 'border-neutral-300',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1.5 text-sm text-error-600">{error}</p>}
      {helperText && !error && <p className="mt-1.5 text-sm text-neutral-500">{helperText}</p>}
    </div>
  );
}
