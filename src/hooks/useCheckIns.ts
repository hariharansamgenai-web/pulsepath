import { useCallback, useEffect, useState } from 'react';
import type { DailyCheckIn } from '@/types';
import { listCheckIns } from '@/lib/checkins';
import { addDays, todayISO } from '@/lib/health';

/** Loads the last `days` days of check-ins for `profileId`, ending today. */
export function useCheckIns(profileId: string | null | undefined, days: number) {
  const [checkIns, setCheckIns] = useState<DailyCheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!profileId) {
      setCheckIns([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const today = todayISO();
      setCheckIns(await listCheckIns(profileId, addDays(today, -(days - 1)), today));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load check-ins.');
    } finally {
      setLoading(false);
    }
  }, [profileId, days]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { checkIns, loading, error, reload };
}
