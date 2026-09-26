import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, Users } from 'lucide-react';
import { useActiveProfile } from '@/context/ActiveProfileContext';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { RELATIONSHIP_LABELS } from '@/lib/profiles';
import { cn } from '@/lib/utils';

/** Top-bar control for choosing whose health records the app shows. */
export function ProfileSwitcher() {
  const { profiles, activeProfile, setActiveProfileId, loading } = useActiveProfile();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  if (loading && !activeProfile) {
    return <div className="h-10 w-36 animate-pulse rounded-lg bg-neutral-100" aria-label="Loading profiles" />;
  }
  if (!activeProfile) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Viewing ${activeProfile.display_name}. Switch profile`}
        className="flex items-center gap-2 rounded-lg border border-neutral-200 py-1 pl-1 pr-2 hover:bg-neutral-50"
      >
        <ProfileAvatar profile={activeProfile} size="sm" />
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-[9rem] truncate text-sm font-medium text-neutral-900">{activeProfile.display_name}</span>
          <span className="block text-xs text-neutral-500">{RELATIONSHIP_LABELS[activeProfile.relationship]}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-neutral-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg animate-fade-in">
          <p className="px-4 pb-1 pt-3 text-xs font-medium text-neutral-500">Show records for</p>
          <ul role="listbox" aria-label="Profiles" className="max-h-72 overflow-y-auto py-1">
            {profiles.map((p) => {
              const selected = p.id === activeProfile.id;
              return (
                <li key={p.id} role="option" aria-selected={selected}>
                  <button
                    onClick={() => {
                      setActiveProfileId(p.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-neutral-50',
                      selected && 'bg-primary-50/60'
                    )}
                  >
                    <ProfileAvatar profile={p} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-neutral-900">{p.display_name}</span>
                      <span className="block text-xs text-neutral-500">{RELATIONSHIP_LABELS[p.relationship]}</span>
                    </span>
                    {selected && <Check className="h-4 w-4 text-primary-600" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            onClick={() => {
              setOpen(false);
              navigate('/family');
            }}
            className="flex w-full items-center gap-2 border-t border-neutral-200 px-4 py-2.5 text-sm font-medium text-primary-700 hover:bg-neutral-50"
          >
            <Users className="h-4 w-4" />
            Manage family profiles
          </button>
        </div>
      )}
    </div>
  );
}
