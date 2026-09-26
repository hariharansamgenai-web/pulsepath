import type { DailyCheckIn } from '@/types';
import { GLUCOSE, longDate, shortDay } from '@/lib/health';

interface GlucoseChartProps {
  days: string[];
  checkIns: DailyCheckIn[];
}

const W = 640;
const H = 220;
const PAD = { left: 40, right: 16, top: 12, bottom: 30 };

type Key = 'glucose_fasting' | 'glucose_post_meal';
const SERIES: { key: Key; label: string; color: string }[] = [
  { key: 'glucose_fasting', label: 'Fasting', color: '#0284c7' },
  { key: 'glucose_post_meal', label: 'After meal', color: '#d97706' },
];

export function GlucoseChart({ days, checkIns }: GlucoseChartProps) {
  const byDate = new Map(checkIns.map((c) => [c.date, c]));
  const values = checkIns
    .flatMap((c) => [c.glucose_fasting, c.glucose_post_meal])
    .filter((v): v is number => v !== null);

  const yMin = 50;
  const yMax = Math.max(250, Math.ceil((Math.max(0, ...values) + 20) / 50) * 50);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (days.length === 1 ? plotW / 2 : (i / (days.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - ((Math.min(v, yMax) - yMin) / (yMax - yMin)) * plotH;

  const ticks: number[] = [];
  for (let t = yMin; t <= yMax; t += 50) ticks.push(t);

  function path(key: Key): string {
    let d = '';
    let pen = false;
    days.forEach((date, i) => {
      const v = byDate.get(date)?.[key] ?? null;
      if (v === null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  }

  const description = SERIES.map((s) => {
    const pts = days.map((d) => byDate.get(d)?.[s.key]).filter((v): v is number => typeof v === 'number');
    return `${s.label}: ${pts.length ? pts.join(', ') : 'no readings'}`;
  }).join('. ');

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Blood sugar mg/dL. ${description}`}>
        <rect x={PAD.left} y={y(GLUCOSE.POST_MEAL_MAX)} width={plotW} height={y(GLUCOSE.LOW) - y(GLUCOSE.POST_MEAL_MAX)} fill="#f0fdf4" />
        <line x1={PAD.left} x2={W - PAD.right} y1={y(GLUCOSE.FASTING_MAX)} y2={y(GLUCOSE.FASTING_MAX)} stroke="#86efac" strokeDasharray="4 4" />
        <text x={W - PAD.right} y={y(GLUCOSE.FASTING_MAX) - 4} textAnchor="end" className="fill-success-700 text-[10px]">
          fasting target ≤ {GLUCOSE.FASTING_MAX}
        </text>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e4e4e7" strokeWidth={0.5} />
            <text x={PAD.left - 8} y={y(t) + 3} textAnchor="end" className="fill-neutral-400 text-[10px]">
              {t}
            </text>
          </g>
        ))}
        {days.map((date, i) => (
          <text key={date} x={x(i)} y={H - 10} textAnchor="middle" className="fill-neutral-500 text-[10px]">
            {days.length <= 10 ? shortDay(date) : date.slice(8)}
          </text>
        ))}
        {SERIES.map((s) => (
          <g key={s.key}>
            <path d={path(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
            {days.map((date, i) => {
              const v = byDate.get(date)?.[s.key] ?? null;
              if (v === null) return null;
              const out = v < GLUCOSE.LOW || v >= GLUCOSE.VERY_HIGH;
              return (
                <circle
                  key={date}
                  cx={x(i)}
                  cy={y(v)}
                  r={out ? 5 : 3.5}
                  fill={out ? '#dc2626' : '#fff'}
                  stroke={out ? '#dc2626' : s.color}
                  strokeWidth={2}
                >
                  <title>{`${s.label}, ${longDate(date)}: ${v} mg/dL`}</title>
                </circle>
              );
            })}
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-600">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm bg-success-50 ring-1 ring-success-200" />
          Target 70–180 mg/dL
        </span>
      </figcaption>
    </figure>
  );
}
