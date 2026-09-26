import type { DailyCheckIn } from '@/types';
import { longDate, shortDay } from '@/lib/health';
import { cn } from '@/lib/utils';

interface MiniBarsProps {
  days: string[];
  checkIns: DailyCheckIn[];
  field: 'steps' | 'sleep_hours' | 'water_ml';
  goal: number;
  format: (v: number) => string;
  color?: 'primary' | 'secondary' | 'accent';
}

const colorMap = {
  primary: { met: 'bg-primary-600', below: 'bg-primary-200' },
  secondary: { met: 'bg-secondary-600', below: 'bg-secondary-200' },
  accent: { met: 'bg-accent-500', below: 'bg-accent-200' },
};

export function MiniBars({ days, checkIns, field, goal, format, color = 'secondary' }: MiniBarsProps) {
  const byDate = new Map(checkIns.map((c) => [c.date, c[field] as number | null]));
  const max = Math.max(goal * 1.3, ...days.map((d) => byDate.get(d) ?? 0));
  const c = colorMap[color];
  return (
    <div className="flex h-24 items-end gap-2" role="list">
      {days.map((date) => {
        const v = byDate.get(date) ?? null;
        const pct = v === null ? 0 : Math.max(4, (v / max) * 100);
        const met = v !== null && v >= goal;
        const label = `${longDate(date)}: ${v === null ? 'not logged' : format(v)}`;
        return (
          <div key={date} role="listitem" className="flex flex-1 flex-col items-center gap-1" title={label}>
            <div className="relative flex h-16 w-full items-end">
              <div className={cn('w-full rounded-t', met ? c.met : c.below)} style={{ height: `${pct}%` }} />
              <span className="sr-only">{label}</span>
            </div>
            <span className="text-[10px] text-neutral-500" aria-hidden>
              {shortDay(date).slice(0, 2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
