import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { HealthAlert } from '@/types';

export function AlertList({ alerts }: { alerts: HealthAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const isCritical = alert.severity === 'critical';
        return (
          <div
            key={alert.id}
            className="alert-rail"
            style={isCritical ? {} : { background: 'var(--warn-bg)', border: '1px solid rgba(245,158,11,.2)', color: 'var(--warn-text)' }}
          >
            {isCritical
              ? <AlertTriangle className="h-4 w-4 shrink-0" style={{ animation: 'pulse 2s infinite' }} />
              : <ShieldAlert className="h-4 w-4 shrink-0" />
            }
            <span>{alert.title}{alert.detail ? " — " + alert.detail : ""}</span>
          </div>
        );
      })}
    </div>
  );
}
