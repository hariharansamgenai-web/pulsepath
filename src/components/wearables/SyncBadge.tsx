import { Smartphone, Pencil } from 'lucide-react';
import type { SyncSource } from '@/types';
import { PROVIDER_REGISTRY } from '@/lib/wearables';
import { cn } from '@/lib/utils';

interface SyncBadgeProps {
  syncSource: SyncSource;
  /** 'sm' (default) or 'xs' for tight spaces */
  size?: 'sm' | 'xs';
}

/**
 * Shows a small provenance label on any health row.
 * - null / undefined = "Manual" (pencil icon, neutral)
 * - provider key = "From <Provider>" (phone icon, teal)
 *
 * Place next to any check-in or activity entry so users always
 * know whether data was typed in or imported from a device.
 */
export function SyncBadge({ syncSource, size = 'sm' }: SyncBadgeProps) {
  const provider = syncSource
    ? PROVIDER_REGISTRY.find((p) => p.type === syncSource)
    : null;

  const label = provider ? `From ${provider.label}` : 'Manual';
  const Icon = provider ? Smartphone : Pencil;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        size === 'xs'
          ? 'px-1.5 py-0.5 text-[10px]'
          : 'px-2 py-0.5 text-xs',
        provider
          ? 'border-teal-200 bg-teal-50 text-teal-700'
          : 'border-neutral-200 bg-neutral-50 text-neutral-500',
      )}
      title={provider ? `Synced from ${provider.label}` : 'Entered manually'}
    >
      <Icon className={size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {label}
    </span>
  );
}
