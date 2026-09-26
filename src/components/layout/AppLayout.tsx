import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useActiveProfile } from '@/context/ActiveProfileContext';
import { RELATIONSHIP_LABELS } from '@/lib/profiles';

export function AppLayout() {
  // Mobile drawer still exists for very small viewports, but sidebar is never hidden on desktop
  const [mobileOpen, setMobileOpen] = useState(false);
  const { activeProfile, selfProfile, setActiveProfileId } = useActiveProfile();
  const viewingOther = activeProfile && selfProfile && activeProfile.id !== selfProfile.id;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-page)' }}>

      {/* ── Permanent sidebar — always visible ── */}
      <aside
        className="layout-sidebar shrink-0"
        style={{ width: 232 }}
        aria-label="Main navigation"
      >
        <Sidebar />
      </aside>

      {/* ── Mobile overlay drawer (small screens only, <640px) ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="layout-sidebar absolute left-0 top-0 h-full animate-slide-in-right"
            style={{ width: 232, zIndex: 51 }}
          >
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setMobileOpen(true)} />

        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">
          <div className="mx-auto max-w-6xl">
            {viewingOther && (
              <div
                className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-sm"
                style={{
                  background: 'var(--accent-bg)',
                  border: '1px solid var(--accent-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <span>
                  Showing records for <strong>{activeProfile.display_name}</strong>{' '}
                  ({RELATIONSHIP_LABELS[activeProfile.relationship]})
                </span>
                <button
                  onClick={() => setActiveProfileId(selfProfile.id)}
                  className="font-semibold underline"
                  style={{ color: 'var(--accent)' }}
                >
                  Back to my records
                </button>
              </div>
            )}
            <Outlet key={activeProfile?.id ?? 'none'} />
          </div>
        </main>
      </div>
    </div>
  );
}
