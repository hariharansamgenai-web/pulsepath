import { useCallback, useEffect, useState } from 'react';
import { loadTimeline, type TimelineEvent, type TimelineEventType } from '@/lib/timeline';

interface UseTimelineOptions {
  profileId: string | null | undefined;
  from: string;
  to: string;
  typeFilter: TimelineEventType | 'all';
}

export function useTimeline({ profileId, from, to, typeFilter }: UseTimelineOptions) {
  const [allEvents, setAllEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!profileId) {
      setAllEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setAllEvents(await loadTimeline(profileId, from, to));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load timeline.');
    } finally {
      setLoading(false);
    }
  }, [profileId, from, to]);

  useEffect(() => {
    reload();
  }, [reload]);

  const events =
    typeFilter === 'all'
      ? allEvents
      : allEvents.filter((e) => e.type === typeFilter);

  return { events, allEvents, loading, error, reload };
}
