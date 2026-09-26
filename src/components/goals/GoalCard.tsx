import { CheckCircle2, Pencil, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { computeGoalProgress, GOAL_CATEGORY_LABELS } from '@/lib/goals';
import { longDate } from '@/lib/health';
import { cn } from '@/lib/utils';
import type { Activity, DailyCheckIn, Goal } from '@/types';

interface GoalCardProps {
  goal: Goal;
  checkIns: DailyCheckIn[];
  activities: Activity[];
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
  onAbandon: () => void;
  onReactivate: () => void;
}

export function GoalCard({ goal, checkIns, activities, onEdit, onDelete, onComplete, onAbandon, onReactivate }: GoalCardProps) {
  const progress = computeGoalProgress(goal, checkIns, activities);
  const done = goal.status === 'completed';
  const abandoned = goal.status === 'abandoned';

  return (
    <div className={cn('card-base p-5', (done || abandoned) && 'opacity-70')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-neutral-900">{goal.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="neutral">{GOAL_CATEGORY_LABELS[goal.category]}</Badge>
            <Badge variant="neutral">{goal.frequency === 'daily' ? 'Daily' : 'Weekly'}</Badge>
            {done && <Badge variant="success">Completed</Badge>}
            {abandoned && <Badge variant="neutral">Abandoned</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton label={`Edit ${goal.title}`} onClick={onEdit}><Pencil className="h-4 w-4" /></IconButton>
          <IconButton label={`Delete ${goal.title}`} onClick={onDelete} danger><Trash2 className="h-4 w-4" /></IconButton>
        </div>
      </div>

      <div className="mt-4">
        {progress.measurable ? (
          <>
            <ProgressBar
              value={progress.value ?? 0}
              max={progress.target ?? 1}
              label={`${formatValue(progress.value)} of ${formatValue(progress.target)} ${goal.unit} (${progress.periodLabel})`}
            />
            {progress.percent !== null && progress.percent >= 100 && goal.status === 'active' && (
              <p className="mt-2 text-xs font-medium text-success-700">Target reached for {progress.periodLabel}.</p>
            )}
          </>
        ) : (
          <p className="text-xs text-neutral-500">
            Progress isn’t tracked automatically for “{goal.unit}” — log check-ins or activities that match steps,
            minutes, L/ml, hours or workouts to see it here.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        <span>
          Since {longDate(goal.start_date)}
          {goal.target_date ? ` · ends ${longDate(goal.target_date)}` : ''}
        </span>
        {goal.status === 'active' ? (
          <div className="flex gap-3">
            <button onClick={onComplete} className="inline-flex items-center gap-1 font-medium text-success-700 hover:text-success-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark complete
            </button>
            <button onClick={onAbandon} className="inline-flex items-center gap-1 font-medium text-neutral-500 hover:text-neutral-700">
              <XCircle className="h-3.5 w-3.5" />
              Abandon
            </button>
          </div>
        ) : (
          <button onClick={onReactivate} className="inline-flex items-center gap-1 font-medium text-primary-700 hover:text-primary-800">
            <RotateCcw className="h-3.5 w-3.5" />
            Reactivate
          </button>
        )}
      </div>
    </div>
  );
}

function formatValue(v: number | null): string {
  if (v === null) return '0';
  return Number.isInteger(v) ? v.toString() : v.toFixed(1);
}

function IconButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className={danger ? 'rounded-md p-2 text-neutral-500 hover:bg-error-50 hover:text-error-600' : 'rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'}>
      {children}
    </button>
  );
}
