import type { ReactNode } from 'react';

type Tone = 'good' | 'watch' | 'neutral';

interface StatTileProps {
  label: string;
  value: string;
  unit?: string;
  tone?: Tone;
  note?: ReactNode;
}

const toneColor: Record<Tone, string> = {
  good:    'var(--good)',
  watch:   'var(--warn)',
  neutral: 'var(--accent)',
};

const toneBorder: Record<Tone, string> = {
  good:    '#10b981',
  watch:   '#f59e0b',
  neutral: 'var(--border-card)',
};

export function StatTile({ label, value, unit, tone = 'neutral', note }: StatTileProps) {
  return (
    <div
      className="card-base p-4"
      style={{ borderTop: `2px solid ${toneBorder[tone]}` }}
    >
      <p className="metric-label mb-2">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className={`metric-val${tone === 'good' ? ' metric-val-good' : ''}`} style={{ color: toneColor[tone] }}>{value}</span>
        {unit && <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
      {note && <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>{note}</p>}
    </div>
  );
}
