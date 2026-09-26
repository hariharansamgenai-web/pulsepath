import {
  Activity,
  Award,
  CheckCircle2,
  FileText,
  HeartPulse,
  Scale,
  Target,
  Utensils,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { TimelineEvent, TimelineEventType } from '@/lib/timeline';
import { cn } from '@/lib/utils';

const icons: Record<TimelineEventType, typeof HeartPulse> = {
  check_in: HeartPulse,
  exercise: Activity,
  weight: Scale,
  goal_created: Target,
  goal_completed: CheckCircle2,
  goal_abandoned: XCircle,
  nutrition: Utensils,
  document: FileText,
  achievement: Award,
};

const iconColors: Record<TimelineEventType, string> = {
  check_in: 'text-primary-600 bg-primary-100',
  exercise: 'text-secondary-600 bg-secondary-100',
  weight: 'text-accent-600 bg-accent-100',
  goal_created: 'text-primary-600 bg-primary-100',
  goal_completed: 'text-success-600 bg-success-100',
  goal_abandoned: 'text-neutral-500 bg-neutral-100',
  nutrition: 'text-accent-600 bg-accent-100',
  document: 'text-neutral-600 bg-neutral-100',
  achievement: 'text-warning-600 bg-warning-100',
};

const badgeVariant: Record<TimelineEventType, 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'neutral'> = {
  check_in: 'primary',
  exercise: 'secondary',
  weight: 'neutral',
  goal_created: 'primary',
  goal_completed: 'success',
  goal_abandoned: 'neutral',
  nutrition: 'neutral',
  document: 'neutral',
  achievement: 'warning',
};

export function TimelineEventCard({ event }: { event: TimelineEvent }) {
  const Icon = icons[event.type];
  return (
    <div className="flex gap-3">
      <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', iconColors[event.type])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900">{event.title}</p>
        {event.detail && <p className="mt-0.5 text-sm text-neutral-600">{event.detail}</p>}
        {event.badges.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {event.badges.map((b) => (
              <Badge key={b} variant={badgeVariant[event.type]}>
                {b}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
