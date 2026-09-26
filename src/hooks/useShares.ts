import { useCallback, useEffect, useState } from 'react';
import { listShares } from '@/lib/sharing';
import type { MedicalShareWithDocuments } from '@/types';

export function useShares(profileId: string | null | undefined) {
  const [shares, setShares] = useState<MedicalShareWithDocuments[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!profileId) { setShares([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setShares(await listShares(profileId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load shares.');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => { reload(); }, [reload]);
  return { shares, loading, error, reload };
}
