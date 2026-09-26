/*
# Phase 13 — Wearable Integration Groundwork

No live integrations are built. This migration only extends the `devices`
table schema so the UI and provider abstraction can reflect real device states.

## New columns on `devices`

| Column | Type | Description |
|---|---|---|
| `connection_status` | text | 'disconnected' \| 'connected' \| 'syncing' \| 'error' |
| `error_message` | text | Last error returned by the provider, if any |
| `provider_account_id` | text | Opaque provider-side user/account ID (never a secret) |
| `scopes` | text[] | OAuth scopes granted by the user |

## Design rationale

`connection_status` is the canonical source of truth for the UI. The app
sets it to `syncing` when a sync is in progress, `connected` on success,
and `error` (with `error_message`) on failure. `last_synced_at` is updated
on every successful sync. `error_message` is overwritten on each attempt so
only the most recent error is stored; it is cleared on reconnect.

`provider_account_id` allows future sync jobs to call the provider's API
without needing to ask the user which account they connected. It must never
hold OAuth tokens or refresh tokens — those belong in a secrets store.

## `sync_source` field on health rows (data provenance)

Manually entered data and provider-synced data must be visually separated
throughout the UI. The existing `daily_checkins` and `activities` tables do
not yet have a provenance column. We add `sync_source` (text, nullable) to both:
- NULL / missing = manually entered by the user (shown as "Manual")
- 'apple_health', 'google_fit', 'fitbit', 'garmin', 'other' = synced from that provider

The CHECK constraint matches the DeviceType enum to keep the two in sync.
*/

-- ── Extend devices ────────────────────────────────────────────────────
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS connection_status   text NOT NULL DEFAULT 'disconnected',
  ADD COLUMN IF NOT EXISTS error_message       text,
  ADD COLUMN IF NOT EXISTS provider_account_id text,
  ADD COLUMN IF NOT EXISTS scopes              text[];

ALTER TABLE public.devices DROP CONSTRAINT IF EXISTS devices_connection_status_check;
ALTER TABLE public.devices ADD CONSTRAINT devices_connection_status_check
  CHECK (connection_status IN ('disconnected', 'connected', 'syncing', 'error'));

ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS samsung_health boolean;
-- Remove the above — use the enum instead
ALTER TABLE public.devices DROP COLUMN IF EXISTS samsung_health;

-- Expand device_type to include samsung_health
ALTER TABLE public.devices DROP CONSTRAINT IF EXISTS devices_device_type_check;
ALTER TABLE public.devices ADD CONSTRAINT devices_device_type_check
  CHECK (device_type IN ('apple_health', 'google_fit', 'fitbit', 'garmin', 'samsung_health', 'other'));

-- ── Data provenance columns ───────────────────────────────────────────
ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS sync_source text;

ALTER TABLE public.daily_checkins DROP CONSTRAINT IF EXISTS daily_checkins_sync_source_check;
ALTER TABLE public.daily_checkins ADD CONSTRAINT daily_checkins_sync_source_check
  CHECK (sync_source IS NULL OR sync_source IN
    ('apple_health', 'google_fit', 'fitbit', 'garmin', 'samsung_health', 'other'));

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS sync_source text;

ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_sync_source_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_sync_source_check
  CHECK (sync_source IS NULL OR sync_source IN
    ('apple_health', 'google_fit', 'fitbit', 'garmin', 'samsung_health', 'other'));
