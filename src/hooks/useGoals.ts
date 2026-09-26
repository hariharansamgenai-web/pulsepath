import { useCallback, useEffect, useState } from 'react';
import type { Goal } from '@/types';
import { listGoals } from '@/lib/goals';

export function useGoals(profileId: string | null | undefined) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!profileId) { setGoals([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setGoals(await listGoals(profileId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load goals.');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => { reload(); }, [reload]);

  return { goals, loading, error, reload };
}
