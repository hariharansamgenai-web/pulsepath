import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, HeartPulse, Pencil, Trash2 } from 'lucide-react';
import { useActiveProfile } from '@/context/ActiveProfileContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Loading } from '@/components/feedback/Loading';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { AlertList } from '@/components/dashboard/AlertList';
import { CheckInForm } from '@/components/health/CheckInForm';
import { useCheckIns } from '@/hooks/useCheckIns';
import { deleteCheckIn } from '@/lib/checkins';
import { evaluateAlerts, longDate, readingStatus, todayISO, type ReadingStatus } from '@/lib/health';
import type { DailyCheckIn } from '@/types';

const statusBadge: Record<ReadingStatus, 'success' | 'warning' | 'error'> = {
  in_range: 'success',
  high: 'warning',
  low: 'error',
  very_high: 'error',
};

export function CheckInsPage() {
  const { activeProfile } = useActiveProfile();
  const { checkIns, loading, error, reload } = useCheckIns(activeProfile?.id, 30);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [saved, setSaved] = useState<DailyCheckIn | null>(null);
  const [toDelete, setToDelete] = useState<DailyCheckIn | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const existing = useMemo(() => checkIns.find((c) => c.date === selectedDate) ?? null, [checkIns, selectedDate]);
  const history = useMemo(() => [...checkIns].reverse(), [checkIns]);
  const alerts = useMemo(() => evaluateAlerts(checkIns), [checkIns]);
  const savedAlerts = useMemo(
    () => (saved ? alerts.filter((a) => a.severity === 'critical' && a.date === saved.date) : []),
    [alerts, saved]
  );

  if (!activeProfile) return <Loading label="Loading profile" />;

  async function handleSaved(c: DailyCheckIn) {
    setSaved(c);
    setSelectedDate(c.date);
    await reload();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCheckIn(toDelete.id);
      setToDelete(null);
      setSaved(null);
      await reload();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete the check-in.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <Card>
          <CardHeader
            title={existing ? `Edit check-in for ${longDate(selectedDate)}` : `Log ${selectedDate === todayISO() ? 'today' : longDate(selectedDate)}`}
            subtitle={`For ${activeProfile.display_name}. Takes under a minute. Skip anything you didn’t measure.`}
            className="mb-6"
          />
          <CheckInForm
            profileId={activeProfile.id}
            existing={existing}
            onSaved={handleSaved}
            onDateChange={(d) => { setSelectedDate(d); setSaved(null); }}
            onCancel={selectedDate !== todayISO() ? () => setSelectedDate(todayISO()) : undefined}
          />
        </Card>

        {saved && (
          <div aria-live="polite">
            {savedAlerts.length > 0 ? (
              <AlertList alerts={savedAlerts} />
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-success-200 bg-success-50 p-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success-600" />
                <p className="text-sm text-success-800">
                  Saved check-in for {longDate(saved.date)}.{' '}
                  <Link to="/dashboard" className="font-medium underline">See your trends</Link>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="lg:col-span-2">
        <Card noPadding>
          <div className="border-b border-neutral-200 px-5 py-4">
            <CardHeader title="Last 30 days" subtitle={`${checkIns.length} check-ins`} />
          </div>
          {loading && checkIns.length === 0 ? (
            <Loading label="Loading check-ins" />
          ) : error ? (
            <div className="p-5"><ErrorState message={error} onRetry={reload} /></div>
          ) : history.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<HeartPulse className="h-6 w-6" />}
                title="No check-ins yet"
                description="Your first entry starts your streak. Log today using the form."
              />
            </div>
          ) : (
            <ul className="max-h-[36rem] divide-y divide-neutral-100 overflow-y-auto">
              {history.map((c) => (
                <li key={c.id} className={c.date === selectedDate ? 'bg-primary-50/60' : undefined}>
                  <div className="flex items-start gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900">{longDate(c.date)}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {c.glucose_fasting !== null && (
                          <Badge variant={statusBadge[readingStatus(c.glucose_fasting, 'fasting')]}>
                            Fasting {c.glucose_fasting}
                          </Badge>
                        )}
                        {c.glucose_post_meal !== null && (
                          <Badge variant={statusBadge[readingStatus(c.glucose_post_meal, 'post_meal')]}>
                            After meal {c.glucose_post_meal}
                          </Badge>
                        )}
                        {c.meds_taken === false && <Badge variant="warning">Missed meds</Badge>}
                        {c.meds_taken === true && <Badge variant="neutral">Meds taken</Badge>}
                        {c.weight_kg !== null && <Badge variant="neutral">{c.weight_kg} kg</Badge>}
                      </div>
                      {c.notes && <p className="mt-1.5 truncate text-xs text-neutral-500">{c.notes}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => { setSelectedDate(c.date); setSaved(null); }}
                        className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                        aria-label={`Edit check-in for ${longDate(c.date)}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setToDelete(c)}
                        className="rounded-md p-1.5 text-neutral-500 hover:bg-error-50 hover:text-error-600"
                        aria-label={`Delete check-in for ${longDate(c.date)}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Delete check-in?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)}>Keep it</Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>Delete check-in</Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          The check-in for {toDelete ? longDate(toDelete.date) : ''} will be removed from your trends and summaries.
        </p>
        {deleteError && <p className="mt-3 text-sm text-error-600">{deleteError}</p>}
      </Modal>
    </div>
  );
}
