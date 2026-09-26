import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/feedback/EmptyState';

interface PagePlaceholderProps {
  title: string;
  description: string;
  icon: ReactNode;
  phase?: string;
}

export function PagePlaceholder({ title, description, icon, phase }: PagePlaceholderProps) {
  return (
    <div className="animate-fade-in-up">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-900">{title}</h2>
        <p className="mt-1 text-sm text-neutral-600">{description}</p>
      </div>
      <Card>
        <EmptyState
          icon={icon}
          title="Coming soon"
          description={
            phase
              ? `This feature will be implemented in ${phase}. The page structure and routing are ready.`
              : 'This feature will be implemented in a later phase. The page structure and routing are ready.'
          }
        />
      </Card>
    </div>
  );
}
