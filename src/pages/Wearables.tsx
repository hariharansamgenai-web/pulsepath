import { AlertCircle, CheckCircle2, Loader2, PlugZap, RefreshCw, Smartphone, WifiOff } from 'lucide-react';
import { useActiveProfile } from '@/context/ActiveProfileContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/feedback/Loading';
import { useDevices } from '@/hooks/useDevices';
import {
  CONNECTION_STATUS_LABELS,
  formatLastSynced,
  PROVIDER_REGISTRY,
  type ProviderDefinition,
} from '@/lib/wearables';
import { cn } from '@/lib/utils';
import type { ConnectionStatus, Device, DeviceType } from '@/types';

const STATUS_ICON: Record<ConnectionStatus, typeof CheckCircle2> = {
  connected: CheckCircle2,
  syncing: Loader2,
  error: AlertCircle,
  disconnected: WifiOff,
};

const STATUS_COLOR: Record<ConnectionStatus, string> = {
  connected: 'text-success-600',
  syncing: 'text-warning-600 animate-spin',
  error: 'text-error-600',
  disconnected: 'text-neutral-400',
};

function StatusPill({ status }: { status: ConnectionStatus }) {
  const Icon = STATUS_ICON[status];
  const variant: 'success' | 'warning' | 'error' | 'neutral' =
    status === 'connected' ? 'success'
    : status === 'syncing' ? 'warning'
    : status === 'error' ? 'error'
    : 'neutral';
  return (
    <Badge variant={variant}>
      <Icon className={cn('h-3 w-3', STATUS_COLOR[status])} />
      {CONNECTION_STATUS_LABELS[status]}
    </Badge>
  );
}

interface ProviderCardProps {
  provider: ProviderDefinition;
  device: Device | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
}

function ProviderCard({ provider, device, onConnect, onDisconnect, onSync }: ProviderCardProps) {
  const status: ConnectionStatus = device?.connection_status ?? 'disconnected';
  const isConnected = status === 'connected' || status === 'syncing';

  return (
    <Card>
      <div className="flex items-start gap-4">
        {/* Provider logo placeholder */}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white text-lg font-bold"
          style={{ backgroundColor: provider.logoColor }}
          aria-hidden
        >
          {provider.label.slice(0, 1)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-neutral-900">{provider.label}</p>
            {device ? (
              <StatusPill status={status} />
            ) : (
              <Badge variant="neutral">Not connected</Badge>
            )}
            {!provider.available && (
              <Badge variant="neutral">Coming soon</Badge>
            )}
          </div>

          <p className="mt-0.5 text-sm text-neutral-600">{provider.description}</p>

          <div className="mt-1 flex flex-wrap gap-1.5">
            {provider.platforms.map((p) => (
              <span key={p} className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 capitalize">{p}</span>
            ))}
          </div>

          {device && (
            <div className="mt-2 space-y-0.5 text-xs text-neutral-500">
              {device.device_name && <p>Device: {device.device_name}</p>}
              <p>Last synced: {formatLastSynced(device.last_synced_at)}</p>
              {status === 'error' && device.error_message && (
                <p className="flex items-center gap-1 text-error-600">
                  <AlertCircle className="h-3 w-3" />
                  {device.error_message}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {!provider.available ? (
            <Button size="sm" variant="outline" disabled>Coming soon</Button>
          ) : isConnected ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={onSync}
                disabled={status === 'syncing'}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', status === 'syncing' && 'animate-spin')} />
                Sync now
              </Button>
              <Button size="sm" variant="ghost" onClick={onDisconnect}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={onConnect}>
              <PlugZap className="h-3.5 w-3.5" />
              Connect
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function WearablesPage() {
  const { activeProfile } = useActiveProfile();
  const { devices, loading, error, reload } = useDevices(activeProfile?.id);

  if (!activeProfile) return <Loading label="Loading profile" />;

  function deviceForType(type: DeviceType): Device | null {
    return devices.find((d) => d.device_type === type) ?? null;
  }

  function handleConnect(provider: ProviderDefinition) {
    // Phase 13: no live integrations — show informational alert only
    alert(
      `${provider.label} integration is coming in a future update.\n\n` +
      `Data you enter manually is always available. When the integration launches, ` +
      `your ${provider.label} data will appear alongside it, clearly labelled "From ${provider.label}".`
    );
  }

  function handleDisconnect(device: Device) {
    alert(`Disconnect would revoke ${device.device_name ?? 'this device'}'s access. Full implementation in a future update.`);
  }

  function handleSync(device: Device) {
    alert(`Sync requested for ${device.device_name ?? 'this device'}. Full implementation in a future update.`);
  }

  const connectedCount = devices.filter((d) => d.connection_status === 'connected').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-.02em' }}>Wearable Devices</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Connect a wearable to automatically import your activity, sleep, and step data for {activeProfile.display_name}.
        </p>
      </div>

      {/* Data provenance notice */}
      <div className="flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
        <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
        <p className="text-sm text-primary-800">
          Data imported from a connected device is labelled <strong>"From [Device]"</strong> everywhere
          it appears — check-ins, activity history, and timeline. Data you enter manually is labelled <strong>"Manual"</strong>.
          The two are never mixed without attribution.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <p className="text-2xl font-bold text-neutral-900">{PROVIDER_REGISTRY.length}</p>
          <p className="text-sm text-neutral-500">Supported providers</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-neutral-900">{connectedCount}</p>
          <p className="text-sm text-neutral-500">Connected</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-neutral-900">0</p>
          <p className="text-sm text-neutral-500">Live (coming soon)</p>
        </Card>
      </div>

      {/* Provider cards */}
      {loading ? (
        <Loading label="Loading devices" />
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
          <AlertCircle className="h-4 w-4" />
          {error}
          <Button size="sm" variant="ghost" onClick={reload}><RefreshCw className="h-3.5 w-3.5" />Retry</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <CardHeader title="Available integrations" subtitle="Live connections are not yet active — all are planned for future phases." />
          {PROVIDER_REGISTRY.map((provider) => {
            const device = deviceForType(provider.type);
            return (
              <ProviderCard
                key={provider.type}
                provider={provider}
                device={device}
                onConnect={() => handleConnect(provider)}
                onDisconnect={() => device && handleDisconnect(device)}
                onSync={() => device && handleSync(device)}
              />
            );
          })}
        </div>
      )}

      {/* Architecture note */}
      <Card>
        <CardHeader title="Integration architecture" subtitle="How device data will flow when integrations go live" className="mb-3" />
        <div className="space-y-2 text-sm text-neutral-600">
          <p>Each provider implements a common interface: <code className="rounded bg-neutral-100 px-1 text-xs">connect()</code>, <code className="rounded bg-neutral-100 px-1 text-xs">sync()</code>, and <code className="rounded bg-neutral-100 px-1 text-xs">disconnect()</code>. Adding a new provider never requires changes to the dashboard or core data model.</p>
          <p>Synced rows carry a <code className="rounded bg-neutral-100 px-1 text-xs">sync_source</code> column that identifies their origin — this is the same field that drives the provenance labels in the UI.</p>
          <p>OAuth tokens are stored server-side only (Supabase Vault or equivalent), never in the browser or in app tables.</p>
        </div>
      </Card>
    </div>
  );
}
