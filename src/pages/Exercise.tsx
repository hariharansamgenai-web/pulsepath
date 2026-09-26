import { useMemo, useState } from 'react';
import { Clock, Dumbbell, Flame, Plus, Route, Pencil, Trash2 } from 'lucide-react';
import { useActiveProfile } from '@/context/ActiveProfileContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Loading } from '@/components/feedback/Loading';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { StatTile } from '@/components/dashboard/StatTile';
import { ActivityForm } from '@/components/activity/ActivityForm';
import { useActivities } from '@/hooks/useActivities';
import { ACTIVITY_LABELS, deleteActivity } from '@/lib/activities';
import { inWindow, longDate, todayISO } from '@/lib/health';
import type { Activity } from '@/types';

type Dialog = { kind: 'create' } | { kind: 'edit'; activity: Activity } | { kind: 'delete'; activity: Activity } | null;

function activityName(a: Activity): string {
  return a.activity_type === 'custom' ? a.custom_label ?? 'Custom activity' : ACTIVITY_LABELS[a.activity_type];
}

export function ExercisePage() {
  const { activeProfile } = useActiveProfile();
  const { activities, loading, error, reload } = useActivities(activeProfile?.id, 90);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const week = useMemo(() => inWindow(activities, todayISO(), 7), [activities]);
  const weekMinutes = week.reduce((sum, a) => sum + a.duration_min, 0);
  const weekCalories = week.reduce((sum, a) => sum + (a.calories_burned ?? 0), 0);
  const weekDistance = week.reduce((sum, a) => sum + (a.distance_km ?? 0), 0);

  if (!activeProfile) return <Loading label="Loading profile" />;

  async function confirmDelete(activity: Activity) {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteActivity(activity.id);
      setDialog(null);
      await reload();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete the activity.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Exercise & activity</h2>
          <p className="mt-1 text-sm text-neutral-600">Log workouts for {activeProfile.display_name} and see this week’s totals.</p>
        </div>
        <Button onClick={() => setDialog({ kind: 'create' })}>
          <Plus className="h-4 w-4" />
          Log activity
        </Button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Workouts this week" value={week.length.toString()} tone={week.length >= 5 ? 'good' : 'neutral'} />
            <StatTile label="Active minutes" value={weekMinutes.toString()} unit="min" tone={weekMinutes >= 150 ? 'good' : 'neutral'} note="Goal 150 min/week (WHO guidance)" />
            <StatTile label="Calories burned" value={weekCalories.toString()} unit="kcal" note="From logged activities" />
            <StatTile label="Distance" value={weekDistance.toFixed(1)} unit="km" note="Walking, running, cycling…" />
          </div>

          <Card noPadding>
            <div className="border-b border-neutral-200 px-5 py-4">
              <CardHeader title="Activity history" subtitle={`Last 90 days · ${activities.length} logged`} />
            </div>
            {loading && activities.length === 0 ? (
              <Loading label="Loading activities" />
            ) : activities.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Dumbbell className="h-6 w-6" />}
                  title="No activities logged yet"
                  description="Log a walk, gym session or any workout to start your history."
                  action={<Button onClick={() => setDialog({ kind: 'create' })}><Plus className="h-4 w-4" />Log activity</Button>}
                />
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {activities.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-neutral-900">{activityName(a)}</p>
                        <Badge variant="neutral">{longDate(a.date)}{a.start_time ? ` · ${a.start_time.slice(0, 5)}` : ''}</Badge>
                        {a.intensity && <Badge variant={a.intensity === 'high' ? 'warning' : 'neutral'}>{a.intensity}</Badge>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{a.duration_min} min</span>
                        {a.distance_km !== null && <span className="inline-flex items-center gap-1"><Route className="h-3.5 w-3.5" />{a.distance_km} km</span>}
                        {a.calories_burned !== null && <span className="inline-flex items-center gap-1"><Flame className="h-3.5 w-3.5" />{a.calories_burned} kcal</span>}
                      </div>
                      {a.notes && <p className="mt-1.5 truncate text-xs text-neutral-500">{a.notes}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => setDialog({ kind: 'edit', activity: a })} className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900" aria-label={`Edit ${activityName(a)} on ${longDate(a.date)}`}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => { setDeleteError(null); setDialog({ kind: 'delete', activity: a }); }} className="rounded-md p-1.5 text-neutral-500 hover:bg-error-50 hover:text-error-600" aria-label={`Delete ${activityName(a)} on ${longDate(a.date)}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <Modal open={dialog?.kind === 'create'} onClose={() => setDialog(null)} title="Log activity" size="lg">
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <ActivityForm profileId={activeProfile.id} onSaved={async () => { setDialog(null); await reload(); }} onCancel={() => setDialog(null)} />
        </div>
      </Modal>

      <Modal open={dialog?.kind === 'edit'} onClose={() => setDialog(null)} title="Edit activity" size="lg">
        {dialog?.kind === 'edit' && (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <ActivityForm profileId={activeProfile.id} activity={dialog.activity} onSaved={async () => { setDialog(null); await reload(); }} onCancel={() => setDialog(null)} />
          </div>
        )}
      </Modal>

      <Modal
        open={dialog?.kind === 'delete'}
        onClose={() => setDialog(null)}
        title="Delete this activity?"
        size="sm"
        footer={dialog?.kind === 'delete' ? (
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Keep it</Button>
            <Button variant="danger" loading={deleting} onClick={() => confirmDelete(dialog.activity)}>Delete</Button>
          </>
        ) : undefined}
      >
        {dialog?.kind === 'delete' && (
          <>
            <p className="text-sm text-neutral-700">
              {activityName(dialog.activity)} on {longDate(dialog.activity.date)} will be permanently removed.
            </p>
            {deleteError && <p className="mt-3 text-sm text-error-600">{deleteError}</p>}
          </>
        )}
      </Modal>
    </div>
  );
}
