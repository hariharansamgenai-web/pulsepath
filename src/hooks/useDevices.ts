import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Device } from '@/types';

export function useDevices(profileId: string | null | undefined) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!profileId) { setDevices([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbErr } = await supabase
        .from('devices')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });
      if (dbErr) throw new Error(dbErr.message);
      setDevices((data ?? []) as Device[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load devices.');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => { reload(); }, [reload]);
  return { devices, loading, error, reload };
}
