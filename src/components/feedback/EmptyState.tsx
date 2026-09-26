import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-200 text-neutral-500">
          {icon}
        </div>
      )}
      <h3 className="mb-1.5 text-base font-semibold text-neutral-900">{title}</h3>
      {description && (
        <p className="mb-6 max-w-sm text-sm text-neutral-600">{description}</p>
      )}
      {action}
    </div>
  );
}
