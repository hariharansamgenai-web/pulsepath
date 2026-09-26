import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, HeartPulse, Dumbbell, Target, Apple, FileText,
  Calendar, Share2, User, Sparkles, Watch,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Each nav item gets a colour that appears on its icon bubble when active
const navItems = [
  { to: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard, color: '#63b3ed' },
  { to: '/check-ins',  label: 'Check-ins',   icon: HeartPulse,      color: '#f87171' },
  { to: '/exercise',   label: 'Exercise',    icon: Dumbbell,        color: '#34d399' },
  { to: '/goals',      label: 'Goals',       icon: Target,          color: '#a78bfa' },
  { to: '/nutrition',  label: 'Nutrition',   icon: Apple,           color: '#fb923c' },
  { to: '/documents',  label: 'Health Vault',   icon: FileText,        color: '#60a5fa' },
  { to: '/timeline',   label: 'History',    icon: Calendar,        color: '#f472b6' },
  { to: '/sharing',    label: 'Sharing',     icon: Share2,          color: '#38bdf8' },
  { to: '/ai-summary', label: 'AI Summary',  icon: Sparkles,        color: '#c084fc' },
  { to: '/wearables',  label: 'Wearable Devices',   icon: Watch,           color: '#4ade80' },
];

const accountItems = [
  { to: '/profile', label: 'Profile', icon: User, color: '#94a3b8' },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex h-full flex-col overflow-y-auto" style={{ padding: '0 0 8px' }}>

      {/* Logo lockup */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid rgba(255,255,255,.07)',
        marginBottom: '4px',
      }}>
        <div className="flex items-center gap-3">
          {/* PulsePath — Dual-lobe heart, matched to reference */}
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: '#000',
            boxShadow: '0 0 24px rgba(139,92,246,.45), 0 0 24px rgba(251,146,60,.35), 0 2px 10px rgba(0,0,0,.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="32" height="30" viewBox="0 0 60 56" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                {/* Left lobe: vivid indigo-violet, radial highlight top-left */}
                <radialGradient id="sb-l" cx="38%" cy="28%" r="65%">
                  <stop offset="0%"   stopColor="#8b5cf6"/>
                  <stop offset="35%"  stopColor="#6d28d9"/>
                  <stop offset="70%"  stopColor="#4338ca"/>
                  <stop offset="100%" stopColor="#1e3a8a"/>
                </radialGradient>
                {/* Right lobe: gold-amber-orange, radial highlight top-right */}
                <radialGradient id="sb-r" cx="62%" cy="22%" r="68%">
                  <stop offset="0%"   stopColor="#fef08a"/>
                  <stop offset="30%"  stopColor="#fbbf24"/>
                  <stop offset="65%"  stopColor="#f97316"/>
                  <stop offset="100%" stopColor="#c2410c"/>
                </radialGradient>
                {/* Centre blend: magenta-purple-dark, matches reference intersection */}
                <radialGradient id="sb-m" cx="50%" cy="55%" r="70%">
                  <stop offset="0%"   stopColor="#db2777" stopOpacity="0.95"/>
                  <stop offset="40%"  stopColor="#9333ea" stopOpacity="0.85"/>
                  <stop offset="80%"  stopColor="#581c87" stopOpacity="0.75"/>
                  <stop offset="100%" stopColor="#1c0533" stopOpacity="0.6"/>
                </radialGradient>
                <clipPath id="sb-lc">
                  <path d="M30,48 C30,48 4,34 4,19 C4,11 10,6 17,6 C22,6 27,9 30,14 L30,48 Z"/>
                </clipPath>
                <clipPath id="sb-rc">
                  <path d="M30,48 C30,48 56,34 56,19 C56,11 50,6 43,6 C38,6 33,9 30,14 L30,48 Z"/>
                </clipPath>
              </defs>
              {/* Black base */}
              <path d="M30,48 C30,48 4,34 4,19 C4,11 10,6 17,6 C23,6 27,10 30,14 C33,10 37,6 43,6 C50,6 56,11 56,19 C56,34 30,48 30,48 Z" fill="#000"/>
              {/* Left lobe */}
              <path d="M30,48 C30,48 4,34 4,19 C4,11 10,6 17,6 C23,6 27,10 30,14 C33,10 37,6 43,6 C50,6 56,11 56,19 C56,34 30,48 30,48 Z" fill="url(#sb-l)" clipPath="url(#sb-lc)"/>
              {/* Right lobe */}
              <path d="M30,48 C30,48 4,34 4,19 C4,11 10,6 17,6 C23,6 27,10 30,14 C33,10 37,6 43,6 C50,6 56,11 56,19 C56,34 30,48 30,48 Z" fill="url(#sb-r)" clipPath="url(#sb-rc)"/>
              {/* Centre leaf blend — wider to match reference */}
              <path d="M30,14 C26,19 23,26 23,31 C23,39 26,44 30,48 C34,44 37,39 37,31 C37,26 34,19 30,14 Z" fill="url(#sb-m)" opacity="0.9"/>
            </svg>
          </div>
          <div style={{ lineHeight: 1 }}>
            {/* Gold gradient wordmark */}
            <p style={{
              fontSize: 16, fontWeight: 900, lineHeight: 1, letterSpacing: '-.03em',
              background: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 40%, #d97706 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              PulsePath
            </p>
            {/* Gold tagline matching reference */}
            <p style={{
              fontSize: 8, marginTop: 3, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
              background: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Small habits · Brighter days
            </p>
          </div>
        </div>
      </div>

      {/* Section: Main */}
      <div style={{ flex: 1, padding: '8px 10px 0' }}>
        <p style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,.28)', padding: '4px 10px 8px',
        }}>Main</p>

        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) => cn('nav-link', isActive && 'nav-link-active')}
            style={({ isActive }) => isActive ? {
              // Active: colour-tinted glass pill
              background: `linear-gradient(135deg, ${item.color}22, ${item.color}11)`,
              boxShadow: `inset 0 0 0 1px ${item.color}33, 0 2px 8px ${item.color}1a`,
              color: '#fff',
            } : {}}
          >
            {({ isActive }) => (
              <>
                {/* Icon bubble */}
                <span style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? `${item.color}30` : 'rgba(255,255,255,.06)',
                  transition: 'background .15s',
                }}>
                  <item.icon style={{
                    width: 15, height: 15, strokeWidth: 2,
                    color: isActive ? item.color : 'rgba(255,255,255,.5)',
                    transition: 'color .15s',
                  }} />
                </span>
                <span style={{ fontSize: 13, transition: 'color .15s' }}>{item.label}</span>
                {/* Active indicator dot */}
                {isActive && (
                  <span style={{
                    marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%',
                    background: item.color, boxShadow: `0 0 6px ${item.color}`,
                  }} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Divider */}
      <div style={{ margin: '8px 16px', height: 1, background: 'rgba(255,255,255,.07)' }} />

      {/* Section: Account */}
      <div style={{ padding: '0 10px 8px' }}>
        <p style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,.28)', padding: '4px 10px 8px',
        }}>Account</p>

        {accountItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) => cn('nav-link', isActive && 'nav-link-active')}
            style={({ isActive }) => isActive ? {
              background: `linear-gradient(135deg, ${item.color}22, ${item.color}11)`,
              boxShadow: `inset 0 0 0 1px ${item.color}33`,
              color: '#fff',
            } : {}}
          >
            {({ isActive }) => (
              <>
                <span style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? `${item.color}30` : 'rgba(255,255,255,.06)',
                }}>
                  <item.icon style={{
                    width: 15, height: 15, strokeWidth: 2,
                    color: isActive ? item.color : 'rgba(255,255,255,.5)',
                  }} />
                </span>
                <span style={{ fontSize: 13 }}>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Bottom: version badge */}
      <div style={{ padding: '0 16px 8px' }}>
        <div style={{
          borderRadius: 8, padding: '8px 12px',
          background: 'rgba(99,179,237,.07)',
          border: '1px solid rgba(99,179,237,.12)',
        }}>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', fontWeight: 600, letterSpacing: '.04em' }}>
            Group AIAP-G35
          </p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,.22)', marginTop: 1 }}>
            Hackathon build · Sep 2026
          </p>
        </div>
      </div>
    </nav>
  );
}
