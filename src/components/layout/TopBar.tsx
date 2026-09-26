import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, LogOut, ChevronDown, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { ProfileSwitcher } from '@/components/profile/ProfileSwitcher';
import { useActiveProfile } from '@/context/ActiveProfileContext';

const pageTitles: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/check-ins':  'Daily Check-ins',
  '/exercise':   'Exercise & Activity',
  '/goals':      'Goals',
  '/nutrition':  'Nutrition',
  '/documents':  'Health Vault',
  '/timeline':   'History',
  '/sharing':    'Sharing',
  '/family':     'Family Profiles',
  '/profile':    'Profile',
  '/ai-summary': 'AI Health Summary',
  '/wearables':  'Wearable Devices',
};

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, profile, signOut } = useAuth();
  const { selfProfile } = useActiveProfile();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const title = pageTitles[location.pathname] || 'PulsePath';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? 'User';

  return (
    <header className="layout-topbar">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 lg:hidden"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Dark / Light toggle */}
        <button
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
          style={{
            background: 'var(--bg-card-2, var(--bg-card))',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <ProfileSwitcher />

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Account menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-1 rounded-lg p-1.5 transition-colors"
            style={{ background: menuOpen ? 'var(--nav-hover-bg)' : 'transparent' }}
          >
            <ProfileAvatar
              profile={{ display_name: displayName, avatar_url: selfProfile?.avatar_url ?? null }}
              size="sm"
            />
            <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-xl py-1 shadow-lg animate-fade-in"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', zIndex: 50 }}
            >
              <p className="truncate border-b px-4 py-2 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                {user?.email}
              </p>
              <button
                onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--nav-hover-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Profile settings
              </button>
              <button
                onClick={() => { setMenuOpen(false); signOut(); }}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm"
                style={{ color: 'var(--danger)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--danger-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
