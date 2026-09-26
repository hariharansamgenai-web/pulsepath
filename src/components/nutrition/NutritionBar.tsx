import type { NutritionSummary } from '@/lib/meals';
import type { IndianDailyTargets } from '@/lib/indianNutrition';

interface NutritionBarProps {
  summary: NutritionSummary;
  targets?: IndianDailyTargets;
  calorieTarget?: number; // legacy compat
}

export function NutritionBar({ summary, targets, calorieTarget }: NutritionBarProps) {
  const calTarget = targets?.calories ?? calorieTarget;
  const stats = [
    { label: 'Calories', value: summary.calories,   unit: 'kcal', target: calTarget,           color: '#63b3ed' },
    { label: 'Protein',  value: summary.protein_g,  unit: 'g',    target: targets?.protein_g,  color: '#34d399' },
    { label: 'Carbs',    value: summary.carbs_g,    unit: 'g',    target: targets?.carbs_g,    color: '#fbbf24' },
    { label: 'Fat',      value: summary.fat_g,      unit: 'g',    target: targets?.fat_g,      color: '#f87171' },
    { label: 'Fiber',    value: summary.fiber_g,    unit: 'g',    target: targets?.fiber_g,    color: '#a78bfa' },
  ];

  return (
    <div className="grid grid-cols-5 gap-3 text-center">
      {stats.map(({ label, value, unit, target, color }) => {
        const pct = target ? Math.min(100, Math.round((value / target) * 100)) : null;
        const over = pct !== null && pct > 100;
        return (
          <div key={label} className="rounded-lg p-2" style={{ background: 'var(--bg-card-2,var(--bg-card))', border: '1px solid var(--border)' }}>
            <p className="text-lg font-bold tabular-nums" style={{ color: over ? 'var(--danger)' : color }}>
              {Number.isInteger(value) ? value : value.toFixed(1)}
              <span className="ml-0.5 text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>{unit}</span>
            </p>
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
            {target !== undefined && target !== null && (
              <div className="mt-1.5">
                <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, pct ?? 0)}%`, background: over ? 'var(--danger)' : color }} />
                </div>
                <p className="mt-0.5 text-[9px]" style={{ color: over ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {pct}% of {target}{unit}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
