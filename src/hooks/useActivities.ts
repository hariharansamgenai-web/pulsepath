import { useCallback, useEffect, useState } from 'react';
import type { Activity } from '@/types';
import { listActivities } from '@/lib/activities';
import { addDays, todayISO } from '@/lib/health';

/** Loads the last `days` days of activities for `profileId`, ending today, newest first. */
export function useActivities(profileId: string | null | undefined, days: number) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!profileId) { setActivities([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const today = todayISO();
      setActivities(await listActivities(profileId, addDays(today, -(days - 1)), today));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load activities.');
    } finally {
      setLoading(false);
    }
  }, [profileId, days]);

  useEffect(() => { reload(); }, [reload]);

  return { activities, loading, error, reload };
}
