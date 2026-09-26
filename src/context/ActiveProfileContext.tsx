import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { listProfiles } from '@/lib/profiles';
import type { Profile } from '@/types';

interface ActiveProfileContextValue {
  /** Every profile the account owner manages ('self' first). */
  profiles: Profile[];
  /** The profile whose health records every page shows. */
  activeProfile: Profile | null;
  /** The account owner's own profile. */
  selfProfile: Profile | null;
  loading: boolean;
  error: string | null;
  setActiveProfileId: (id: string) => void;
  /** Re-fetch profiles (after create / edit / delete). */
  refresh: () => Promise<Profile[]>;
}

const ActiveProfileContext = createContext<ActiveProfileContextValue | undefined>(undefined);

const storageKey = (userId: string) => `phm.activeProfile.${userId}`;

function readStored(userId: string): string | null {
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

function writeStored(userId: string, id: string) {
  try {
    localStorage.setItem(storageKey(userId), id);
  } catch {
    // Storage unavailable (private mode): selection just won't survive a refresh.
  }
}

export function ActiveProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfiles([]);
      setActiveId(null);
      setLoading(false);
      return [];
    }
    setError(null);
    try {
      const list = await listProfiles();
      setProfiles(list);
      setActiveId((current) => {
        const wanted = current ?? readStored(userId);
        // Only accept an id that belongs to this account; otherwise fall back to 'self'.
        const valid = list.find((p) => p.id === wanted);
        const next = valid ?? list.find((p) => p.relationship === 'self') ?? list[0] ?? null;
        if (next) writeStored(userId, next.id);
        return next?.id ?? null;
      });
      return list;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load profiles.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Reload when the signed-in user changes; never carry one user's selection into another's session.
  useEffect(() => {
    setLoading(true);
    setProfiles([]);
    setActiveId(null);
    refresh();
  }, [refresh]);

  const setActiveProfileId = useCallback(
    (id: string) => {
      if (!userId || !profiles.some((p) => p.id === id)) return;
      writeStored(userId, id);
      setActiveId(id);
    },
    [userId, profiles]
  );

  const value = useMemo<ActiveProfileContextValue>(
    () => ({
      profiles,
      activeProfile: profiles.find((p) => p.id === activeId) ?? null,
      selfProfile: profiles.find((p) => p.relationship === 'self') ?? null,
      loading,
      error,
      setActiveProfileId,
      refresh,
    }),
    [profiles, activeId, loading, error, setActiveProfileId, refresh]
  );

  return <ActiveProfileContext.Provider value={value}>{children}</ActiveProfileContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useActiveProfile() {
  const ctx = useContext(ActiveProfileContext);
  if (!ctx) throw new Error('useActiveProfile must be used within an ActiveProfileProvider');
  return ctx;
}
