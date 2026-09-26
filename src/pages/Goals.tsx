import { useMemo, useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { useActiveProfile } from '@/context/ActiveProfileContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Loading } from '@/components/feedback/Loading';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { GoalForm } from '@/components/goals/GoalForm';
import { GoalCard } from '@/components/goals/GoalCard';
import { useGoals } from '@/hooks/useGoals';
import { useCheckIns } from '@/hooks/useCheckIns';
import { useActivities } from '@/hooks/useActivities';
import { deleteGoal, setGoalStatus } from '@/lib/goals';
import type { Goal } from '@/types';

type Dialog = { kind: 'create' } | { kind: 'edit'; goal: Goal } | { kind: 'delete'; goal: Goal } | null;

export function GoalsPage() {
  const { activeProfile } = useActiveProfile();
  const { goals, loading, error, reload } = useGoals(activeProfile?.id);
  // 7 days covers both daily (today) and weekly (rolling 7-day) progress windows.
  const { checkIns } = useCheckIns(activeProfile?.id, 7);
  const { activities } = useActivities(activeProfile?.id, 7);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const active = useMemo(() => goals.filter((g) => g.status === 'active'), [goals]);
  const inactive = useMemo(() => goals.filter((g) => g.status !== 'active'), [goals]);

  if (!activeProfile) return <Loading label="Loading profile" />;
  if (loading && goals.length === 0) return <Loading label="Loading goals" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  async function changeStatus(goal: Goal, status: Goal['status']) {
    await setGoalStatus(goal.id, status);
    await reload();
  }

  async function confirmDelete(goal: Goal) {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteGoal(goal.id);
      setDialog(null);
      await reload();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete the goal.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Goals</h2>
          <p className="mt-1 text-sm text-neutral-600">Targets for {activeProfile.display_name}, tracked against real logged data.</p>
        </div>
        <Button onClick={() => setDialog({ kind: 'create' })}>
          <Plus className="h-4 w-4" />
          New goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="No goals yet"
          description="Set a target like 8,000 steps a day or 5 workouts a week — progress fills in automatically as you log check-ins and activities."
          action={<Button onClick={() => setDialog({ kind: 'create' })}><Plus className="h-4 w-4" />New goal</Button>}
        />
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  checkIns={checkIns}
                  activities={activities}
                  onEdit={() => setDialog({ kind: 'edit', goal: g })}
                  onDelete={() => { setDeleteError(null); setDialog({ kind: 'delete', goal: g }); }}
                  onComplete={() => changeStatus(g, 'completed')}
                  onAbandon={() => changeStatus(g, 'abandoned')}
                  onReactivate={() => changeStatus(g, 'active')}
                />
              ))}
            </div>
          )}

          {inactive.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-neutral-700">Completed & abandoned</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {inactive.map((g) => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    checkIns={checkIns}
                    activities={activities}
                    onEdit={() => setDialog({ kind: 'edit', goal: g })}
                    onDelete={() => { setDeleteError(null); setDialog({ kind: 'delete', goal: g }); }}
                    onComplete={() => changeStatus(g, 'completed')}
                    onAbandon={() => changeStatus(g, 'abandoned')}
                    onReactivate={() => changeStatus(g, 'active')}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={dialog?.kind === 'create'} onClose={() => setDialog(null)} title="New goal" size="lg">
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <GoalForm profileId={activeProfile.id} onSaved={async () => { setDialog(null); await reload(); }} onCancel={() => setDialog(null)} />
        </div>
      </Modal>

      <Modal open={dialog?.kind === 'edit'} onClose={() => setDialog(null)} title="Edit goal" size="lg">
        {dialog?.kind === 'edit' && (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <GoalForm profileId={activeProfile.id} goal={dialog.goal} onSaved={async () => { setDialog(null); await reload(); }} onCancel={() => setDialog(null)} />
          </div>
        )}
      </Modal>

      <Modal
        open={dialog?.kind === 'delete'}
        onClose={() => setDialog(null)}
        title="Delete this goal?"
        size="sm"
        footer={dialog?.kind === 'delete' ? (
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Keep it</Button>
            <Button variant="danger" loading={deleting} onClick={() => confirmDelete(dialog.goal)}>Delete goal</Button>
          </>
        ) : undefined}
      >
        {dialog?.kind === 'delete' && (
          <>
            <p className="text-sm text-neutral-700">“{dialog.goal.title}” will be permanently removed. Your logged check-ins and activities are not affected.</p>
            {deleteError && <p className="mt-3 text-sm text-error-600">{deleteError}</p>}
          </>
        )}
      </Modal>
    </div>
  );
}
