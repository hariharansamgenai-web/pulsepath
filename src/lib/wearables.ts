/**
 * Wearable provider abstraction — Phase 13
 *
 * Defines the interface every future provider must implement. Adding a new
 * wearable (e.g. Samsung Health, Whoop) requires only:
 *   1. A new ProviderDefinition entry in PROVIDER_REGISTRY.
 *   2. A class that satisfies WearableProvider.
 *
 * No changes to the dashboard, health-data model, or existing providers.
 *
 * Phase 13 ships ZERO live integrations. All providers are in 'coming_soon'
 * state. When a live integration is ready, its `available` flag flips to true
 * and its `connect()` / `sync()` methods are implemented.
 */

import type { ConnectionStatus, DeviceType } from '@/types';

// ---------------------------------------------------------------------------
// Provider interface — every future integration implements this
// ---------------------------------------------------------------------------
export interface WearableProvider {
  /** Open the OAuth / pairing flow for this provider. */
  connect(profileId: string): Promise<void>;
  /** Pull data since `since` and write it into Supabase as the user's rows. */
  sync(deviceId: string, since: Date): Promise<SyncResult>;
  /** Tear down the connection and clear stored tokens / consent. */
  disconnect(deviceId: string): Promise<void>;
}

export interface SyncResult {
  checkInsImported: number;
  activitiesImported: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Static provider registry — drives the UI, independent of live connections
// ---------------------------------------------------------------------------
export interface ProviderDefinition {
  type: DeviceType;
  label: string;
  description: string;
  /** Platforms this provider works on. Used to show conditional notes. */
  platforms: ('ios' | 'android' | 'web')[];
  /** Whether a real integration is implemented. False = coming soon. */
  available: boolean;
  logoColor: string;
}

export const PROVIDER_REGISTRY: ProviderDefinition[] = [
  {
    type: 'apple_health',
    label: 'Apple Health',
    description: 'Sync steps, workouts, sleep, and weight from Apple Health and Apple Watch.',
    platforms: ['ios'],
    available: false, // Requires iOS HealthKit — not available in Phase 13
    logoColor: '#ff3b30',
  },
  {
    type: 'google_fit',
    label: 'Google Health Connect',
    description: 'Sync activity, sleep, and nutrition from Android devices via Health Connect.',
    platforms: ['android'],
    available: false,
    logoColor: '#4285f4',
  },
  {
    type: 'fitbit',
    label: 'Fitbit',
    description: 'Sync daily steps, heart rate, sleep stages, and active minutes from Fitbit devices.',
    platforms: ['ios', 'android', 'web'],
    available: false,
    logoColor: '#00b0b9',
  },
  {
    type: 'garmin',
    label: 'Garmin Connect',
    description: 'Sync GPS activities, heart rate variability, and sleep data from Garmin watches.',
    platforms: ['ios', 'android', 'web'],
    available: false,
    logoColor: '#007dc5',
  },
  {
    type: 'samsung_health',
    label: 'Samsung Health',
    description: 'Sync steps, workouts, and sleep from Galaxy Watch and Samsung devices.',
    platforms: ['android'],
    available: false,
    logoColor: '#1428a0',
  },
];

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------
export const CONNECTION_STATUS_LABELS: Record<ConnectionStatus, string> = {
  disconnected: 'Not connected',
  connected: 'Connected',
  syncing: 'Syncing…',
  error: 'Connection error',
};

export const CONNECTION_STATUS_TONES: Record<ConnectionStatus, 'neutral' | 'success' | 'warning' | 'error'> = {
  disconnected: 'neutral',
  connected: 'success',
  syncing: 'warning',
  error: 'error',
};

export function formatLastSynced(ts: string | null): string {
  if (!ts) return 'Never synced';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 2) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs} hour${diffHrs === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}
