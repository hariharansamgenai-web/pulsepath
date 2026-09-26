import type { ChartPoint } from '@/lib/timeline';
import { shortDay } from '@/lib/health';

interface SimpleLineChartProps {
  data: ChartPoint[];
  unit: string;
  color?: string;
  goalLine?: number;
  goalLabel?: string;
  height?: number;
}

const W = 600;
const PAD = { left: 44, right: 16, top: 12, bottom: 28 };

export function SimpleLineChart({
  data,
  unit,
  color = '#0284c7',
  goalLine,
  goalLabel,
  height = 180,
}: SimpleLineChartProps) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-500">No data to show for this period.</p>;
  }

  const H = height;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const values = data.map((d) => d.value);
  const yMin = Math.min(...values, goalLine ?? Infinity) * 0.9;
  const yMax = Math.max(...values, goalLine ?? -Infinity) * 1.1 || 1;

  const x = (i: number) =>
    PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) =>
    PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const ticks: number[] = [];
  const step = Math.max(1, Math.ceil((yMax - yMin) / 4));
  for (let t = Math.ceil(yMin / step) * step; t <= yMax; t += step) ticks.push(t);

  const pathD = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${unit} chart`}>
      {goalLine !== undefined && (
        <>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(goalLine)}
            y2={y(goalLine)}
            stroke="#86efac"
            strokeDasharray="4 4"
          />
          {goalLabel && (
            <text x={W - PAD.right} y={y(goalLine) - 4} textAnchor="end" className="fill-success-700 text-[10px]">
              {goalLabel}
            </text>
          )}
        </>
      )}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e4e4e7" strokeWidth={0.5} />
          <text x={PAD.left - 8} y={y(t) + 3} textAnchor="end" className="fill-neutral-400 text-[10px]">
            {Number.isInteger(t) ? t : t.toFixed(1)}
          </text>
        </g>
      ))}
      {data.map((d, i) => (
        <text
          key={d.date}
          x={x(i)}
          y={H - 8}
          textAnchor="middle"
          className="fill-neutral-500 text-[10px]"
        >
          {data.length <= 14 ? shortDay(d.date) : d.date.slice(8)}
        </text>
      ))}
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={d.date} cx={x(i)} cy={y(d.value)} r={3} fill="#fff" stroke={color} strokeWidth={2}>
          <title>{`${d.label}: ${Number.isInteger(d.value) ? d.value : d.value.toFixed(1)} ${unit}`}</title>
        </circle>
      ))}
    </svg>
  );
}
