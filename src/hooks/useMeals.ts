import { useCallback, useEffect, useState } from 'react';
import type { MealWithLogs } from '@/types';
import { listMeals } from '@/lib/meals';
import { addDays, todayISO } from '@/lib/health';

export function useMeals(profileId: string | null | undefined, days: number) {
  const [meals, setMeals] = useState<MealWithLogs[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!profileId) { setMeals([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const today = todayISO();
      setMeals(await listMeals(profileId, addDays(today, -(days - 1)), today));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load meals.');
    } finally {
      setLoading(false);
    }
  }, [profileId, days]);

  useEffect(() => { reload(); }, [reload]);
  return { meals, loading, error, reload };
}
