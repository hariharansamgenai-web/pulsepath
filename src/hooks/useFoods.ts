import { useCallback, useEffect, useState } from 'react';
import type { Food } from '@/types';
import { listFoods } from '@/lib/foods';

export function useFoods(profileId: string | null | undefined) {
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!profileId) { setFoods([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setFoods(await listFoods(profileId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load foods.');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => { reload(); }, [reload]);
  return { foods, loading, error, reload };
}
