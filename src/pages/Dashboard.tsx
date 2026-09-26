import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, Bell, BellRing, Brain,
  CheckCircle2, ChevronRight, Clock, Database, Droplet, FileText,
  HeartPulse, Laptop, Moon, Phone, Pill, Plus, RefreshCw,
  Sparkles, Target, TrendingDown, TrendingUp, Users, Watch, X, Zap,
} from 'lucide-react';
import { useActiveProfile } from '@/context/ActiveProfileContext';
import { Loading } from '@/components/feedback/Loading';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useCheckIns } from '@/hooks/useCheckIns';
import { loadDemoData } from '@/lib/checkins';
import {
  GLUCOSE, SLEEP_GOAL_HOURS, STEP_GOAL, WATER_GOAL_ML,
  addDays, computeStats, dateRange, evaluateAlerts, findInsights,
  inWindow, loggingStreak, todayISO,
} from '@/lib/health';

// ─── Emergency contacts ──────────────────────────────────────────────────────
const FAMILY_CONTACTS = [
  { name: 'Shirpi (Partner)', relation: 'Partner', phone: '+6591234567', avatar: 'S' },
  { name: 'Amma',             relation: 'Mother',  phone: '+919876543210', avatar: 'A' },
  { name: 'Dr. Priya Nair',  relation: 'Doctor',  phone: '+6562345678', avatar: 'P' },
];

// ─── Logo SVG ────────────────────────────────────────────────────────────────
function DualLobeLogo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.93} viewBox="0 0 30 28" fill="none">
      <defs>
        <radialGradient id="dlg-l" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#7c3aed"/><stop offset="60%" stopColor="#4f46e5"/><stop offset="100%" stopColor="#2563eb"/>
        </radialGradient>
        <radialGradient id="dlg-r" cx="65%" cy="25%" r="70%">
          <stop offset="0%" stopColor="#fde68a"/><stop offset="40%" stopColor="#f59e0b"/><stop offset="100%" stopColor="#ea580c"/>
        </radialGradient>
        <radialGradient id="dlg-m" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#c026d3" stopOpacity="0.9"/><stop offset="50%" stopColor="#9333ea" stopOpacity="0.7"/><stop offset="100%" stopColor="#7c2d12" stopOpacity="0.5"/>
        </radialGradient>
        <clipPath id="dlg-lc"><path d="M15,24 C15,24 2,17 2,9.5 C2,5.5 5,3 8.5,3 C11,3 13.5,4.5 15,7 L15,24 Z"/></clipPath>
        <clipPath id="dlg-rc"><path d="M15,24 C15,24 28,17 28,9.5 C28,5.5 25,3 21.5,3 C19,3 16.5,4.5 15,7 L15,24 Z"/></clipPath>
      </defs>
      <path d="M15,24 C15,24 2,17 2,9.5 C2,5.5 5,3 8.5,3 C11.5,3 13.5,5 15,7 C16.5,5 18.5,3 21.5,3 C25,3 28,5.5 28,9.5 C28,17 15,24 15,24 Z" fill="#000"/>
      <path d="M15,24 C15,24 2,17 2,9.5 C2,5.5 5,3 8.5,3 C11.5,3 13.5,5 15,7 C16.5,5 18.5,3 21.5,3 C25,3 28,5.5 28,9.5 C28,17 15,24 15,24 Z" fill="url(#dlg-l)" clipPath="url(#dlg-lc)"/>
      <path d="M15,24 C15,24 2,17 2,9.5 C2,5.5 5,3 8.5,3 C11.5,3 13.5,5 15,7 C16.5,5 18.5,3 21.5,3 C25,3 28,5.5 28,9.5 C28,17 15,24 15,24 Z" fill="url(#dlg-r)" clipPath="url(#dlg-rc)"/>
      <path d="M15,7 C13.5,9 12,12 12,14 C12,18 13.5,21 15,24 C16.5,21 18,18 18,14 C18,12 16.5,9 15,7 Z" fill="url(#dlg-m)" opacity="0.85"/>
    </svg>
  );
}

// ─── Emergency Modal ─────────────────────────────────────────────────────────
function EmergencyModal({ onClose }: { onClose: () => void }) {
  const [called, setCalled] = useState<string[]>([]);
  const [countdown, setCountdown] = useState(5);
  const [autoSent, setAutoSent] = useState(false);
  useMemo(() => {
    if (autoSent) return;
    const t = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(t); setAutoSent(true); return 0; } return c - 1; }), 1000);
    return () => clearInterval(t);
  }, [autoSent]);
  return (
    <div style={{ position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,.8)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%',maxWidth:420,borderRadius:20,overflow:'hidden',background:'var(--bg-card)',border:'1px solid rgba(239,68,68,.4)',boxShadow:'0 0 60px rgba(239,68,68,.25)' }}>
        <div style={{ background:'linear-gradient(135deg,#dc2626,#b91c1c)',padding:'20px 24px 16px' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            <div style={{ display:'flex',alignItems:'center',gap:12 }}>
              <div style={{ width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,.2)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <BellRing style={{ width:22,height:22,color:'#fff' }} className="animate-pulse"/>
              </div>
              <div>
                <p style={{ fontSize:18,fontWeight:800,color:'#fff',letterSpacing:'-.02em' }}>Emergency Alert</p>
                <p style={{ fontSize:12,color:'rgba(255,255,255,.7)',marginTop:2 }}>{autoSent?'Alert sent to all contacts':`Auto-sending in ${countdown}s`}</p>
              </div>
            </div>
            <button onClick={onClose} style={{ color:'rgba(255,255,255,.6)',background:'none',border:'none',cursor:'pointer',padding:4 }}><X style={{ width:20,height:20 }}/></button>
          </div>
          {!autoSent && <div style={{ marginTop:14,height:4,borderRadius:2,background:'rgba(255,255,255,.2)' }}><div style={{ height:'100%',borderRadius:2,background:'#fff',width:`${((5-countdown)/5)*100}%`,transition:'width 1s linear' }}/></div>}
        </div>
        <div style={{ padding:'16px 20px 20px' }}>
          <p style={{ fontSize:11,fontWeight:700,color:'var(--text-muted)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:12 }}>Call family & care team</p>
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {FAMILY_CONTACTS.map(c => { const wasCalled = called.includes(c.phone); return (
              <a key={c.phone} href={`tel:${c.phone}`} onClick={()=>setCalled(p=>[...p,c.phone])} style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:12,textDecoration:'none',background:wasCalled?'var(--good-bg)':'var(--bg-card-2,var(--bg-card))',border:`1px solid ${wasCalled?'rgba(16,185,129,.3)':'var(--border)'}` }}>
                <div style={{ width:38,height:38,borderRadius:'50%',flexShrink:0,background:wasCalled?'var(--good)':'#dc2626',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'#fff' }}>{wasCalled?'✓':c.avatar}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <p style={{ fontSize:13,fontWeight:600,color:'var(--text-primary)' }}>{c.name}</p>
                  <p style={{ fontSize:11,color:'var(--text-muted)' }}>{c.relation} · {c.phone}</p>
                </div>
                <div style={{ display:'flex',alignItems:'center',gap:5,fontSize:12,fontWeight:600,color:wasCalled?'var(--good-text)':'#dc2626' }}>
                  <Phone style={{ width:14,height:14 }}/>{wasCalled?'Called':'Call now'}
                </div>
              </a>
            );})}
          </div>
          <button onClick={()=>setCalled(FAMILY_CONTACTS.map(c=>c.phone))} style={{ marginTop:12,width:'100%',padding:'10px',borderRadius:10,border:'none',cursor:'pointer',background:'#dc2626',color:'#fff',fontSize:13,fontWeight:700 }}>🚨 Alert all contacts — I need help</button>
          <button onClick={onClose} style={{ marginTop:8,width:'100%',padding:'8px',borderRadius:10,border:'1px solid var(--border)',cursor:'pointer',background:'transparent',color:'var(--text-secondary)',fontSize:13 }}>I'm OK — Cancel alert</button>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable card atoms ──────────────────────────────────────────────────────
function Sec({ children, title, action }: { children: React.ReactNode; title?: string; action?: React.ReactNode }) {
  return (
    <div style={{ padding:'16px 18px',borderRadius:18,background:'var(--bg-card)',border:'1px solid var(--border)' }}>
      {title && <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
        <p style={{ fontSize:11,fontWeight:700,color:'var(--text-muted)',letterSpacing:'.08em',textTransform:'uppercase' }}>{title}</p>
        {action}
      </div>}
      {children}
    </div>
  );
}

function KpiTile({ label, value, unit, tone, note }: { label:string;value:string;unit:string;tone:'good'|'warn'|'danger'|'neutral';note?:React.ReactNode }) {
  const C = { good:'#10b981',warn:'#f59e0b',danger:'#ef4444',neutral:'var(--accent)' }[tone];
  const BG = { good:'rgba(16,185,129,.08)',warn:'rgba(245,158,11,.08)',danger:'rgba(239,68,68,.08)',neutral:'var(--accent-bg)' }[tone];
  return (
    <div style={{ padding:'14px 16px',borderRadius:16,background:BG,border:`1px solid ${C}33`,borderTop:`3px solid ${C}` }}>
      <p style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:6 }}>{label}</p>
      <p style={{ fontSize:28,fontWeight:800,color:C,letterSpacing:'-.04em',lineHeight:1 }}>
        {value}<span style={{ fontSize:12,fontWeight:500,marginLeft:3,color:'var(--text-muted)' }}>{unit}</span>
      </p>
      {note && <p style={{ fontSize:11,color:'var(--text-muted)',marginTop:5,display:'flex',alignItems:'center',gap:4 }}>{note}</p>}
    </div>
  );
}

function HabitRing({ label,value,max,unit,color,sublabel }: { label:string;value:number|null;max:number;unit:string;color:string;sublabel?:string }) {
  const r=28; const circ=2*Math.PI*r; const pct=value!==null?Math.min(value/max,1):0; const dash=circ*pct;
  return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:6 }}>
      <div style={{ position:'relative',width:72,height:72 }}>
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke={`${color}22`} strokeWidth="7"/>
          <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7" strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round" transform="rotate(-90 36 36)" style={{ transition:'stroke-dasharray .6s ease' }}/>
        </svg>
        <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
          <p style={{ fontSize:13,fontWeight:800,color,lineHeight:1,letterSpacing:'-.02em' }}>
            {value!==null?(unit==='h'?value.toFixed(1):Math.round(value).toLocaleString()):'–'}
          </p>
          <p style={{ fontSize:9,color:'var(--text-muted)',marginTop:1 }}>{unit}</p>
        </div>
      </div>
      <p style={{ fontSize:11,fontWeight:600,color:'var(--text-secondary)',textAlign:'center' }}>{label}</p>
      {sublabel&&<p style={{ fontSize:10,color:'var(--text-muted)',textAlign:'center',marginTop:-4 }}>{sublabel}</p>}
    </div>
  );
}

function ActionCard({ icon, color, bg, title, subtitle, action, actionLabel, actionVariant='outline' }: {
  icon:React.ReactNode;color:string;bg:string;title:string;subtitle:string;
  action:()=>void;actionLabel:string;actionVariant?:'outline'|'filled';
}) {
  return (
    <div style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:14,border:`1px solid ${color}33`,background:bg }}>
      <div style={{ width:40,height:40,borderRadius:10,background:`${color}22`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>{icon}</div>
      <div style={{ flex:1,minWidth:0 }}>
        <p style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{title}</p>
        <p style={{ fontSize:11,color:'var(--text-muted)',marginTop:1 }}>{subtitle}</p>
      </div>
      <button onClick={action} style={{
        padding:'6px 12px',borderRadius:8,border:actionVariant==='filled'?'none':`1px solid ${color}44`,
        background:actionVariant==='filled'?color:`${color}18`,color:actionVariant==='filled'?'#fff':color,
        fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,
      }}>{actionLabel}</button>
    </div>
  );
}

// ─── Calendar booking widget ─────────────────────────────────────────────────
const APPOINTMENT = {
  doctor: 'Dr. Priya Nair',
  specialty: 'Diabetologist',
  clinic: 'SGH Diabetes Clinic',
  address: '1 Hospital Drive, Block 7, Singapore 169608',
  phone: '+65 6222 3322',
  defaultDate: '2026-10-15',
  defaultTime: '10:30',
  duration: 30, // minutes
};

const TIME_SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00','16:30'];

function AppointmentCard() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(APPOINTMENT.defaultDate);
  const [time, setTime] = useState(APPOINTMENT.defaultTime);
  const [booked, setBooked] = useState(false);
  const [adding, setAdding] = useState(false);

  // Build ICS file content
  function buildICS() {
    const [y,mo,d] = date.split('-').map(Number);
    const [h,mi] = time.split(':').map(Number);
    const pad = (n:number) => String(n).padStart(2,'0');
    const dtStart = `${y}${pad(mo)}${pad(d)}T${pad(h)}${pad(mi)}00`;
    const endMin = mi + APPOINTMENT.duration;
    const endH = h + Math.floor(endMin/60);
    const dtEnd = `${y}${pad(mo)}${pad(d)}T${pad(endH)}${pad(endMin%60)}00`;
    return [
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PulsePath//Health//EN',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@pulsepath.app`,
      `DTSTAMP:${dtStart}Z`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:Appointment with ${APPOINTMENT.doctor}`,
      `DESCRIPTION:${APPOINTMENT.specialty} visit\n${APPOINTMENT.clinic}\nPhone: ${APPOINTMENT.phone}`,
      `LOCATION:${APPOINTMENT.address}`,
      'BEGIN:VALARM','TRIGGER:-PT60M','ACTION:DISPLAY',
      `DESCRIPTION:Reminder: ${APPOINTMENT.doctor} in 1 hour`,
      'END:VALARM',
      'END:VEVENT','END:VCALENDAR'
    ].join('\r\n');
  }

  function downloadICS() {
    const blob = new Blob([buildICS()], { type:'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url;
    a.download = `appointment-dr-priya-nair.ics`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function googleCalendarUrl() {
    const [y,mo,d] = date.split('-').map(Number);
    const [h,mi] = time.split(':').map(Number);
    const pad = (n:number) => String(n).padStart(2,'0');
    const dtStart = `${y}${pad(mo)}${pad(d)}T${pad(h)}${pad(mi)}00`;
    const endMin = mi + APPOINTMENT.duration;
    const endH = h + Math.floor(endMin/60);
    const dtEnd = `${y}${pad(mo)}${pad(d)}T${pad(endH)}${pad(endMin%60)}00`;
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `Appointment with ${APPOINTMENT.doctor}`,
      dates: `${dtStart}/${dtEnd}`,
      details: `${APPOINTMENT.specialty} visit\n${APPOINTMENT.clinic}\nPhone: ${APPOINTMENT.phone}`,
      location: APPOINTMENT.address,
    });
    return `https://calendar.google.com/calendar/render?${params}`;
  }

  function handleBook() {
    setAdding(true);
    setTimeout(() => { setAdding(false); setBooked(true); setOpen(false); }, 900);
  }

  const displayDate = date ? new Date(date+'T12:00:00').toLocaleDateString('en-SG',{ weekday:'short',day:'numeric',month:'long',year:'numeric' }) : '';

  if (booked) return (
    <div style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:14,background:'rgba(16,185,129,.06)',border:'1px solid rgba(16,185,129,.3)' }}>
      <div style={{ width:40,height:40,borderRadius:10,background:'rgba(16,185,129,.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
        <CheckCircle2 style={{ width:20,height:20,color:'#10b981' }}/>
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <p style={{ fontSize:13,fontWeight:700,color:'#10b981' }}>Appointment confirmed ✓</p>
        <p style={{ fontSize:11,color:'var(--text-muted)',marginTop:1 }}>{APPOINTMENT.doctor} · {displayDate} · {time} · {APPOINTMENT.clinic}</p>
      </div>
      <div style={{ display:'flex',gap:6,flexShrink:0 }}>
        <button onClick={downloadICS} title="Download .ics" style={{ padding:'5px 10px',borderRadius:8,border:'1px solid rgba(16,185,129,.3)',background:'rgba(16,185,129,.1)',color:'#10b981',fontSize:11,fontWeight:600,cursor:'pointer' }}>
          ⬇ .ics
        </button>
        <a href={googleCalendarUrl()} target="_blank" rel="noopener noreferrer"
          style={{ padding:'5px 10px',borderRadius:8,border:'1px solid rgba(66,133,244,.3)',background:'rgba(66,133,244,.1)',color:'#4285f4',fontSize:11,fontWeight:600,cursor:'pointer',textDecoration:'none',display:'flex',alignItems:'center',gap:4 }}>
          📅 Google
        </a>
        <button onClick={()=>{ setBooked(false); setOpen(true); }} style={{ padding:'5px 8px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:11,cursor:'pointer' }}>
          Reschedule
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ borderRadius:14,border:`1px solid ${open?'rgba(167,139,250,.4)':'var(--border)'}`,overflow:'hidden',transition:'border-color .2s' }}>
      {/* Header row */}
      <div style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'rgba(167,139,250,.05)' }}>
        <div style={{ width:40,height:40,borderRadius:10,background:'rgba(167,139,250,.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
          <Clock style={{ width:18,height:18,color:'#a78bfa' }}/>
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <p style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>
            Next appointment · {APPOINTMENT.doctor}
          </p>
          <p style={{ fontSize:11,color:'var(--text-muted)',marginTop:1 }}>
            {APPOINTMENT.clinic} · {new Date(APPOINTMENT.defaultDate+'T12:00:00').toLocaleDateString('en-SG',{ day:'numeric',month:'short',year:'numeric' })} · {APPOINTMENT.defaultTime}
          </p>
        </div>
        <button onClick={()=>setOpen(o=>!o)} style={{
          padding:'6px 14px',borderRadius:8,border:'1px solid rgba(167,139,250,.4)',
          background: open ? '#a78bfa' : 'rgba(167,139,250,.15)',
          color: open ? '#fff' : '#a78bfa',
          fontSize:11,fontWeight:700,cursor:'pointer',flexShrink:0,transition:'all .2s',
        }}>
          {open ? '✕ Close' : '📅 Book / reschedule'}
        </button>
      </div>

      {/* Expanded booking panel */}
      {open && (
        <div style={{ padding:'16px 14px',background:'var(--bg-card)',borderTop:'1px solid var(--border)' }}>
          {/* Doctor info */}
          <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,background:'rgba(167,139,250,.06)',border:'1px solid rgba(167,139,250,.15)',marginBottom:14 }}>
            <div style={{ width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#a78bfa,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:14,fontWeight:800,color:'#fff' }}>P</div>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{APPOINTMENT.doctor}</p>
              <p style={{ fontSize:11,color:'var(--text-muted)' }}>{APPOINTMENT.specialty} · {APPOINTMENT.clinic}</p>
              <p style={{ fontSize:10,color:'var(--text-muted)' }}>{APPOINTMENT.address}</p>
            </div>
            <a href={`tel:${APPOINTMENT.phone}`} style={{ display:'flex',alignItems:'center',gap:5,padding:'6px 10px',borderRadius:8,background:'rgba(167,139,250,.12)',border:'1px solid rgba(167,139,250,.25)',color:'#a78bfa',textDecoration:'none',fontSize:11,fontWeight:600,flexShrink:0 }}>
              <Phone style={{ width:12,height:12 }}/> Call clinic
            </a>
          </div>

          {/* Date + Time pickers */}
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14 }}>
            <div>
              <label style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',letterSpacing:'.08em',textTransform:'uppercase',display:'block',marginBottom:6 }}>Date</label>
              <input type="date" value={date} min={new Date().toISOString().slice(0,10)}
                onChange={e=>setDate(e.target.value)}
                style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-input)',color:'var(--text-primary)',fontSize:13,outline:'none' }}/>
            </div>
            <div>
              <label style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',letterSpacing:'.08em',textTransform:'uppercase',display:'block',marginBottom:6 }}>Time slot</label>
              <select value={time} onChange={e=>setTime(e.target.value)}
                style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-input)',color:'var(--text-primary)',fontSize:13,outline:'none' }}>
                {TIME_SLOTS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Time slot quick picks */}
          <p style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:8 }}>Quick pick a slot</p>
          <div style={{ display:'flex',flexWrap:'wrap',gap:6,marginBottom:14 }}>
            {TIME_SLOTS.map(t=>(
              <button key={t} onClick={()=>setTime(t)} style={{
                padding:'5px 10px',borderRadius:8,border:`1px solid ${time===t?'#a78bfa':'var(--border)'}`,
                background:time===t?'rgba(167,139,250,.2)':'transparent',
                color:time===t?'#a78bfa':'var(--text-muted)',
                fontSize:11,fontWeight:time===t?700:500,cursor:'pointer',transition:'all .15s',
              }}>{t}</button>
            ))}
          </div>

          {/* Confirmation summary */}
          {date && time && (
            <div style={{ padding:'10px 12px',borderRadius:10,background:'rgba(167,139,250,.08)',border:'1px solid rgba(167,139,250,.2)',marginBottom:12 }}>
              <p style={{ fontSize:12,fontWeight:600,color:'#a78bfa' }}>
                📋 {APPOINTMENT.doctor} · {displayDate} at {time} ({APPOINTMENT.duration} min)
              </p>
              <p style={{ fontSize:11,color:'var(--text-muted)',marginTop:3 }}>{APPOINTMENT.clinic} · Reminder set 1 hour before</p>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8 }}>
            <button onClick={handleBook} disabled={!date||!time||adding}
              style={{ padding:'10px',borderRadius:10,border:'none',background:'#a78bfa',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',opacity:adding?.7:1 }}>
              {adding?'Saving…':'✓ Confirm'}
            </button>
            <button onClick={downloadICS} disabled={!date||!time}
              style={{ padding:'10px',borderRadius:10,border:'1px solid var(--border)',background:'transparent',color:'var(--text-secondary)',fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5 }}>
              ⬇ Download .ics
            </button>
            <a href={googleCalendarUrl()} target="_blank" rel="noopener noreferrer"
              style={{ padding:'10px',borderRadius:10,border:'1px solid rgba(66,133,244,.35)',background:'rgba(66,133,244,.08)',color:'#4285f4',fontSize:12,fontWeight:600,cursor:'pointer',textDecoration:'none',display:'flex',alignItems:'center',justifyContent:'center',gap:5 }}>
              📅 Google Cal
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const { activeProfile } = useActiveProfile();
  const navigate = useNavigate();
  const { checkIns, loading, error, reload } = useCheckIns(activeProfile?.id, 14);
  const [seeding, setSeeding] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);

  const today = todayISO();
  const days  = useMemo(() => dateRange(today, 7), [today]);

  const view = useMemo(() => {
    const week     = inWindow(checkIns, today, 7);
    const previous = inWindow(checkIns, addDays(today, -7), 7);
    return {
      week, previous,
      stats:     computeStats(week),
      prevStats: computeStats(previous),
      alerts:    evaluateAlerts(checkIns, today),
      insights:  findInsights(week, previous),
      streak:    loggingStreak(checkIns, today),
      todayEntry: checkIns.find(c => c.date === today) ?? null,
    };
  }, [checkIns, today]);

  if (!activeProfile) return <Loading label="Loading profile"/>;
  if (loading && checkIns.length === 0) return <Loading label="Loading dashboard"/>;
  if (error) return <ErrorState message={error} onRetry={reload}/>;

  const name = activeProfile.display_name;
  const { stats, prevStats, alerts, insights, streak, todayEntry, week } = view;
  const fastingDiff = stats.avgFasting!==null && prevStats.avgFasting!==null ? stats.avgFasting-prevStats.avgFasting : null;
  const hour = new Date().getHours();
  const greeting = hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';

  // Today values
  const todayMeds  = todayEntry?.meds_taken;
  const todaySteps = todayEntry?.steps ?? null;
  const todayWater = todayEntry?.water_ml ?? null;
  const todaySleep = todayEntry?.sleep_hours ?? null;
  const todayStress = todayEntry?.stress_level ?? null;

  const hasData = checkIns.length > 0;

  // ── Medication attention ───────────────────────────────────────────────────
  const medsDue     = todayMeds === false;
  const medsNotLogged = todayMeds === null;
  // ── Stress / burnout ──────────────────────────────────────────────────────
  const highStress  = todayStress !== null && todayStress >= 7;
  const avgStress   = week.length > 0 ? week.reduce((s,c)=>s+(c.stress_level??0),0)/week.filter(c=>c.stress_level!==null).length : 0;
  const burnoutRisk = avgStress >= 6;
  // ── Screen time score (0 = none, 10 = excessive) ──────────────────────────
  // Signals: short sleep, high stress, poor sleep quality, late energy, bad mood
  function screenTimeScore(sleep: number | null, stress: number | null, sleepQ: number | null, energy: number | null, mood: string | null): number {
    let score = 0;
    if (sleep !== null) {
      if (sleep < 5)   score += 3.5;
      else if (sleep < 6) score += 2.5;
      else if (sleep < 7) score += 1;
    }
    if (stress !== null) {
      if (stress >= 8) score += 3;
      else if (stress >= 6) score += 2;
      else if (stress >= 4) score += 0.5;
    }
    if (sleepQ !== null && sleepQ <= 2) score += 1.5;
    if (energy !== null && energy <= 3)  score += 1;
    if (mood === 'bad' || mood === 'terrible') score += 1;
    return Math.min(10, Math.round(score * 10) / 10);
  }
  const todayScreenScore = screenTimeScore(todaySleep, todayStress, todayEntry?.sleep_quality ?? null, todayEntry?.energy_level ?? null, todayEntry?.mood ?? null);
  const weekScreenScores = week.map(c => ({
    date: c.date,
    score: screenTimeScore(c.sleep_hours, c.stress_level, c.sleep_quality ?? null, c.energy_level ?? null, c.mood ?? null),
  }));
  const avgScreenScore = weekScreenScores.length > 0 ? weekScreenScores.reduce((s,c)=>s+c.score,0)/weekScreenScores.length : 0;
  const screenWarning = todayScreenScore >= 5;
  const screenLevel = todayScreenScore >= 7 ? 'high' : todayScreenScore >= 4 ? 'moderate' : 'low';
  const screenColor = screenLevel === 'high' ? '#ef4444' : screenLevel === 'moderate' ? '#f59e0b' : '#10b981';
  const screenHasData = todayEntry !== null && (todaySleep !== null || todayStress !== null);
  // ── Wearable sync ─────────────────────────────────────────────────────────
  const noStepsLogged = todaySteps === null && todayEntry !== null;

  // Summary counts
  const attentionCount = [medsDue, highStress, screenWarning].filter(Boolean).length;
  const urgentCount = alerts.filter(a=>a.severity==='critical').length;

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:18 }}>

      {/* ── HERO HEADER ───────────────────────────────────────────────────── */}
      <div style={{
        display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,
        background:'linear-gradient(135deg,rgba(124,58,237,.1) 0%,rgba(245,158,11,.07) 100%)',
        borderRadius:20,padding:'18px 20px',border:'1px solid var(--border)',
      }}>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:12,color:'var(--text-muted)',fontWeight:500 }}>{greeting}</p>
          <h2 style={{ fontSize:24,fontWeight:800,color:'var(--text-primary)',letterSpacing:'-.03em',lineHeight:1.1,marginTop:2 }}>
            {name} 👋
          </h2>
          {todayEntry ? (
            <div style={{ display:'flex',alignItems:'center',gap:6,marginTop:6 }}>
              <CheckCircle2 style={{ width:14,height:14,color:'#10b981' }}/>
              <span style={{ fontSize:12,color:'#10b981',fontWeight:600 }}>Today logged</span>
              <span style={{ fontSize:12,color:'var(--text-muted)' }}>· {streak} day streak 🔥</span>
            </div>
          ) : (
            <button onClick={()=>navigate('/check-ins')} style={{ marginTop:8,display:'inline-flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:10,background:'#7c3aed',color:'#fff',fontSize:12,fontWeight:700,border:'none',cursor:'pointer' }}>
              <Plus style={{ width:13,height:13 }}/>Log today's check-in
            </button>
          )}
        </div>
        {/* Emergency SOS bell */}
        <button onClick={()=>setShowEmergency(true)} title="SOS Emergency — alert family"
          style={{
            width:58,height:58,borderRadius:16,border:'2px solid rgba(239,68,68,.6)',
            background:'rgba(239,68,68,.12)',
            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
            cursor:'pointer',flexShrink:0,gap:1,
            boxShadow:'0 0 16px rgba(239,68,68,.25)',
          }}>
          {/* Bell icon */}
          <Bell style={{ width:20,height:20,color:'#ef4444' }}/>
          {/* SOS label */}
          <span style={{
            fontSize:9,fontWeight:900,color:'#ef4444',
            letterSpacing:'.12em',lineHeight:1,
            fontFamily:'system-ui,sans-serif',
          }}>SOS</span>
        </button>
      </div>

      {/* ── HEALTH SNAPSHOT STRIP ─────────────────────────────────────────── */}
      {hasData && (
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10 }}>
          {[
            { label:'On Track', count:Math.max(0,5-attentionCount-urgentCount), color:'#10b981' },
            { label:'Attention', count:attentionCount, color:'#f59e0b' },
            { label:'Urgent', count:urgentCount, color:'#ef4444' },
          ].map(s=>(
            <div key={s.label} style={{ padding:'12px 14px',borderRadius:14,background:'var(--bg-card)',border:'1px solid var(--border)',textAlign:'center' }}>
              <p style={{ fontSize:22,fontWeight:800,color:s.color }}>{s.count}</p>
              <p style={{ fontSize:10,fontWeight:600,color:'var(--text-muted)',marginTop:2,textTransform:'uppercase',letterSpacing:'.06em' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── NO DATA EMPTY STATE ────────────────────────────────────────────── */}
      {!hasData && (
        <div style={{ textAlign:'center',padding:'32px 24px',borderRadius:20,background:'var(--bg-card)',border:'1px solid var(--border)' }}>
          <DualLobeLogo size={48}/>
          <p style={{ fontSize:16,fontWeight:700,color:'var(--text-primary)',marginTop:12 }}>Start with today's check-in</p>
          <p style={{ fontSize:13,color:'var(--text-secondary)',marginTop:6,marginBottom:16 }}>Log medication, blood sugar, stress and habits. Your dashboard fills up after a few days.</p>
          <div style={{ display:'flex',justifyContent:'center',gap:10 }}>
            <button onClick={()=>navigate('/check-ins')} style={{ padding:'8px 18px',borderRadius:10,background:'#7c3aed',color:'#fff',fontSize:13,fontWeight:700,border:'none',cursor:'pointer' }}>Log today</button>
            <button onClick={async()=>{ if(!activeProfile)return; setSeeding(true); try{await loadDemoData(activeProfile.id);await reload();}finally{setSeeding(false);} }} disabled={seeding}
              style={{ padding:'8px 18px',borderRadius:10,border:'1px solid var(--border)',background:'transparent',color:'var(--text-secondary)',fontSize:13,fontWeight:600,cursor:'pointer' }}>
              <Database style={{ width:13,height:13,display:'inline',marginRight:5,verticalAlign:'middle' }}/>{seeding?'Loading…':'Load demo data'}
            </button>
          </div>
        </div>
      )}

      {hasData && (<>

        {/* ── TODAY SNAPSHOT ────────────────────────────────────────────────── */}
        <Sec title="Today">
          <div style={{ display:'flex',flexWrap:'wrap',gap:'8px 20px',fontSize:13 }}>
            {([
              { icon:<HeartPulse style={{ width:14,height:14,color:'#ef4444' }}/>, label:`Medication ${todayMeds===true?'✓':todayMeds===false?'✗':'–'}`, color:todayMeds===true?'#10b981':todayMeds===false?'#ef4444':'var(--text-muted)' },
              { icon:<Activity style={{ width:14,height:14,color:'#0d9488' }}/>, label:`Steps ${todaySteps!==null?todaySteps.toLocaleString():'–'}`, color:todaySteps!==null&&todaySteps>=STEP_GOAL?'#10b981':'var(--text-secondary)' },
              { icon:<Droplet style={{ width:14,height:14,color:'#0ea5e9' }}/>, label:`Water ${todayWater!==null?(todayWater/1000).toFixed(1)+'L':'–'}`, color:todayWater!==null&&todayWater>=WATER_GOAL_ML?'#10b981':'var(--text-secondary)' },
              { icon:<Moon style={{ width:14,height:14,color:'#a78bfa' }}/>, label:`Sleep ${todaySleep!==null?todaySleep.toFixed(1)+'h':'–'}`, color:todaySleep!==null&&todaySleep>=SLEEP_GOAL_HOURS?'#10b981':'var(--text-secondary)' },
              { icon:<Brain style={{ width:14,height:14,color:'#f472b6' }}/>, label:`Stress ${todayStress!==null?todayStress+'/10':'–'}`, color:todayStress!==null?(todayStress<=4?'#10b981':todayStress<=6?'#f59e0b':'#ef4444'):'var(--text-muted)' },
              ...(todayEntry?.glucose_fasting!=null?[{ icon:<Zap style={{ width:14,height:14,color:'#f59e0b' }}/>, label:`Fasting ${todayEntry.glucose_fasting} mg/dL`, color:todayEntry.glucose_fasting<=GLUCOSE.FASTING_MAX?'#10b981':'#f59e0b' }]:[]),
            ] as Array<{ icon:React.ReactNode;label:string;color:string }>).map((item,i)=>(
              <div key={i} style={{ display:'flex',alignItems:'center',gap:5 }}>
                {item.icon}<span style={{ color:item.color,fontWeight:500 }}>{item.label}</span>
              </div>
            ))}
          </div>
          <button onClick={()=>navigate('/check-ins')} style={{ marginTop:10,fontSize:11,fontWeight:600,color:'var(--accent)',background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:4 }}>
            Edit today's check-in <ChevronRight style={{ width:12,height:12 }}/>
          </button>
        </Sec>

        {/* ── SECTION 1: MEDICATION REMINDERS ──────────────────────────────── */}
        <div>
          <p style={{ fontSize:11,fontWeight:700,color:'var(--text-muted)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:10,display:'flex',alignItems:'center',gap:6 }}>
            <Pill style={{ width:13,height:13 }}/> Medication & Appointments
          </p>
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            <ActionCard
              icon={<Pill style={{ width:18,height:18,color:medsDue?'#ef4444':'#10b981' }}/>}
              color={medsDue?'#ef4444':medsNotLogged?'#f59e0b':'#10b981'}
              bg={medsDue?'rgba(239,68,68,.05)':medsNotLogged?'rgba(245,158,11,.05)':'rgba(16,185,129,.05)'}
              title={medsDue?'Evening dose not taken':medsNotLogged?'Medication not logged today':'Medication taken ✓'}
              subtitle={medsDue?'Tap to log your medication now':'Log your dose to maintain your streak'}
              action={()=>navigate('/check-ins')}
              actionLabel={medsDue?'Log dose now':medsNotLogged?'Log dose':'Done'}
              actionVariant={medsDue?'filled':'outline'}
            />
            <ActionCard
              icon={<RefreshCw style={{ width:18,height:18,color:'#60a5fa' }}/>}
              color="#60a5fa" bg="rgba(96,165,250,.05)"
              title="Metformin refill due in 5 days"
              subtitle="Based on your last prescription · SGH Diabetes Clinic"
              action={()=>navigate('/documents')}
              actionLabel="View prescription"
            />
            <AppointmentCard />
          </div>
        </div>

        {/* ── SECTION 2: STRESS / BURNOUT / SCREEN TIME ────────────────────── */}
        <div>
          <p style={{ fontSize:11,fontWeight:700,color:'var(--text-muted)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:10,display:'flex',alignItems:'center',gap:6 }}>
            <Brain style={{ width:13,height:13 }}/> Mental wellbeing & Screen time
          </p>
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {/* Stress gauge */}
            <div style={{ padding:'14px 16px',borderRadius:14,background:highStress?'rgba(239,68,68,.06)':burnoutRisk?'rgba(245,158,11,.06)':'rgba(16,185,129,.05)',border:`1px solid ${highStress?'rgba(239,68,68,.3)':burnoutRisk?'rgba(245,158,11,.3)':'rgba(16,185,129,.25)'}` }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
                <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                  <Brain style={{ width:16,height:16,color:highStress?'#ef4444':burnoutRisk?'#f59e0b':'#10b981' }}/>
                  <p style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>Stress level today</p>
                </div>
                <span style={{ fontSize:20,fontWeight:800,color:highStress?'#ef4444':burnoutRisk?'#f59e0b':'#10b981' }}>
                  {todayStress!==null?`${todayStress}/10`:'–'}
                </span>
              </div>
              {/* Stress bar */}
              <div style={{ height:8,borderRadius:4,background:'var(--border)',overflow:'hidden' }}>
                <div style={{ height:'100%',borderRadius:4,width:`${todayStress!==null?(todayStress/10)*100:0}%`,background:highStress?'#ef4444':burnoutRisk?'#f59e0b':'#10b981',transition:'width .5s ease' }}/>
              </div>
              <div style={{ display:'flex',justifyContent:'space-between',marginTop:6 }}>
                <span style={{ fontSize:10,color:'var(--text-muted)' }}>Low stress</span>
                <span style={{ fontSize:10,color:'var(--text-muted)' }}>High stress</span>
              </div>
              {(highStress||burnoutRisk) && (
                <div style={{ marginTop:10,display:'flex',gap:8 }}>
                  <button onClick={()=>navigate('/check-ins')} style={{ flex:1,padding:'7px',borderRadius:8,border:'none',background:highStress?'#ef4444':'#f59e0b',color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer' }}>
                    {highStress?'Log how you feel & act now':'Log stress & get tips'}
                  </button>
                </div>
              )}
              {burnoutRisk && !highStress && (
                <p style={{ fontSize:11,color:'#f59e0b',marginTop:8,fontWeight:500 }}>
                  ⚠️ 7-day average stress {avgStress.toFixed(1)}/10 — possible burnout risk. Consider a break.
                </p>
              )}
            </div>

            {/* Screen time tracker — functional */}
            <div style={{ padding:'14px 16px',borderRadius:14,background:screenHasData?`${screenColor}08`:'var(--bg-card-2,var(--bg-card))',border:`1px solid ${screenHasData?`${screenColor}30`:'var(--border)'}` }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
                <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                  <Laptop style={{ width:16,height:16,color:screenHasData?screenColor:'var(--text-muted)' }}/>
                  <p style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>Screen time exposure</p>
                </div>
                {screenHasData && (
                  <div style={{ textAlign:'right' }}>
                    <span style={{ fontSize:22,fontWeight:900,color:screenColor,letterSpacing:'-.03em' }}>{todayScreenScore.toFixed(1)}</span>
                    <span style={{ fontSize:11,color:'var(--text-muted)',marginLeft:2 }}>/10</span>
                  </div>
                )}
              </div>

              {!screenHasData ? (
                <div>
                  <p style={{ fontSize:12,color:'var(--text-muted)',marginBottom:10 }}>Log sleep duration and stress level in today's check-in to calculate your screen exposure risk.</p>
                  <button onClick={()=>navigate('/check-ins')} style={{ padding:'7px 14px',borderRadius:8,border:'none',background:'var(--accent)',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer' }}>
                    Log check-in now →
                  </button>
                </div>
              ) : (
                <>
                  {/* Score bar */}
                  <div style={{ marginBottom:10 }}>
                    <div style={{ height:8,borderRadius:4,background:'var(--border)',overflow:'hidden' }}>
                      <div style={{ height:'100%',borderRadius:4,width:`${(todayScreenScore/10)*100}%`,background:`linear-gradient(90deg,#10b981,${todayScreenScore>5?'#f59e0b':'#10b981'},${todayScreenScore>7?'#ef4444':'transparent'})`,transition:'width .6s ease' }}/>
                    </div>
                    <div style={{ display:'flex',justifyContent:'space-between',marginTop:4 }}>
                      <span style={{ fontSize:9,color:'var(--text-muted)' }}>Low</span>
                      <span style={{ fontSize:9,color:'var(--text-muted)' }}>Moderate</span>
                      <span style={{ fontSize:9,color:'var(--text-muted)' }}>High</span>
                    </div>
                  </div>

                  {/* 7-day mini bars */}
                  {weekScreenScores.length > 0 && (
                    <div style={{ marginBottom:10 }}>
                      <p style={{ fontSize:10,fontWeight:600,color:'var(--text-muted)',marginBottom:6 }}>7-DAY PATTERN</p>
                      <div style={{ display:'flex',gap:4,alignItems:'flex-end',height:32 }}>
                        {days.map(day => {
                          const d = weekScreenScores.find(s=>s.date===day);
                          const sc = d?.score ?? 0;
                          const barH = Math.max(4, Math.round((sc/10)*32));
                          const bc = sc>=7?'#ef4444':sc>=4?'#f59e0b':'#10b981';
                          const isToday = day === today;
                          const dayL = new Date(day+'T12:00:00').toLocaleDateString('en',{ weekday:'narrow' });
                          return (
                            <div key={day} style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3 }}>
                              <div style={{ width:'100%',borderRadius:3,background:bc,height:barH,opacity:isToday?1:.6,outline:isToday?`2px solid ${bc}`:'none' }}/>
                              <span style={{ fontSize:9,color:isToday?'var(--text-primary)':'var(--text-muted)',fontWeight:isToday?700:400 }}>{dayL}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Status + tips */}
                  <div style={{ padding:'10px 12px',borderRadius:10,background:`${screenColor}12`,border:`1px solid ${screenColor}25` }}>
                    <p style={{ fontSize:12,fontWeight:700,color:screenColor,marginBottom:6 }}>
                      {screenLevel==='high'?'🔴 High screen exposure detected':screenLevel==='moderate'?'🟡 Moderate screen exposure':'🟢 Screen time looks healthy'}
                    </p>
                    {screenLevel==='high' && (
                      <ul style={{ margin:0,padding:0,listStyle:'none',display:'flex',flexDirection:'column',gap:4 }}>
                        {[
                          todaySleep!==null&&todaySleep<6?`🛌 Sleep was only ${todaySleep.toFixed(1)}h — screens likely displaced rest time`:null,
                          todayStress!==null&&todayStress>=6?`😰 Stress at ${todayStress}/10 — scrolling often increases cortisol`:null,
                          '📵 Try screen-free 1hr before bed',
                          '⏱ Set app timers for social media',
                        ].filter(Boolean).map((tip,i)=><li key={i} style={{ fontSize:11,color:'var(--text-secondary)' }}>{tip}</li>)}
                      </ul>
                    )}
                    {screenLevel==='moderate' && (
                      <ul style={{ margin:0,padding:0,listStyle:'none',display:'flex',flexDirection:'column',gap:4 }}>
                        {[
                          '🌙 Wind down screens by 9:30 PM',
                          '☀️ Get 10 min of morning sunlight to reset sleep rhythm',
                          todayStress!==null&&todayStress>=4?`🧘 Stress at ${todayStress}/10 — try a 5-min breathing break`:null,
                        ].filter(Boolean).map((tip,i)=><li key={i} style={{ fontSize:11,color:'var(--text-secondary)' }}>{tip}</li>)}
                      </ul>
                    )}
                    {screenLevel==='low' && (
                      <p style={{ fontSize:11,color:'var(--text-secondary)' }}>
                        {avgScreenScore>4?`This is better than your 7-day avg (${avgScreenScore.toFixed(1)}/10). Keep it up!`:'Your sleep and stress patterns suggest healthy screen habits today.'}
                      </p>
                    )}
                  </div>

                  <button onClick={()=>navigate('/check-ins')} style={{ marginTop:10,fontSize:11,fontWeight:600,color:'var(--accent)',background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',alignItems:'center',gap:4 }}>
                    Update today's data <ChevronRight style={{ width:11,height:11 }}/>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── SECTION 3: WEARABLE INTEGRATION ─────────────────────────────── */}
        <div>
          <p style={{ fontSize:11,fontWeight:700,color:'var(--text-muted)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:10,display:'flex',alignItems:'center',gap:6 }}>
            <Watch style={{ width:13,height:13 }}/> Wearable devices
          </p>
          <div style={{ padding:'14px 16px',borderRadius:14,background:'var(--bg-card)',border:'1px solid var(--border)' }}>
            <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:12 }}>
              <div style={{ width:40,height:40,borderRadius:10,background:'rgba(74,222,128,.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                <Watch style={{ width:20,height:20,color:'#4ade80' }}/>
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>No wearable connected</p>
                <p style={{ fontSize:11,color:'var(--text-muted)' }}>Connect Apple Health, Fitbit, Garmin or Samsung Health to auto-fill steps, sleep and heart rate.</p>
              </div>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6 }}>
              {[
                { name:'Apple Health', icon:'🍎', color:'#f87171' },
                { name:'Fitbit', icon:'💪', color:'#4ade80' },
                { name:'Garmin', icon:'⌚', color:'#60a5fa' },
                { name:'Samsung', icon:'📱', color:'#a78bfa' },
              ].map(d=>(
                <button key={d.name} onClick={()=>navigate('/wearables')} style={{ padding:'8px 4px',borderRadius:10,border:'1px solid var(--border)',background:'transparent',cursor:'pointer',textAlign:'center' }}>
                  <p style={{ fontSize:16 }}>{d.icon}</p>
                  <p style={{ fontSize:9,fontWeight:600,color:'var(--text-muted)',marginTop:3 }}>{d.name}</p>
                </button>
              ))}
            </div>
            {noStepsLogged && (
              <div style={{ marginTop:10,padding:'8px 12px',borderRadius:8,background:'rgba(74,222,128,.08)',border:'1px solid rgba(74,222,128,.2)' }}>
                <p style={{ fontSize:11,color:'#4ade80',fontWeight:600 }}>💡 Connect a wearable to auto-log steps and sleep instead of entering them manually.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── KPI TILES ─────────────────────────────────────────────────────── */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10 }}>
          <KpiTile label="Fasting sugar · 7-day avg"
            value={stats.avgFasting===null?'–':Math.round(stats.avgFasting).toString()} unit="mg/dL"
            tone={stats.avgFasting===null?'neutral':stats.avgFasting<=GLUCOSE.FASTING_MAX?'good':'warn'}
            note={fastingDiff===null?`Target ${GLUCOSE.FASTING_MIN}–${GLUCOSE.FASTING_MAX}`:(
              <span style={{ display:'flex',alignItems:'center',gap:3 }}>
                {fastingDiff<=0?<TrendingDown style={{ width:11,height:11 }}/>:<TrendingUp style={{ width:11,height:11 }}/>}
                {Math.abs(Math.round(fastingDiff))} vs last week
              </span>
            )}
          />
          <KpiTile label="Time in range" value={stats.timeInRange===null?'–':Math.round(stats.timeInRange).toString()} unit="%" tone={stats.timeInRange===null?'neutral':stats.timeInRange>=70?'good':'warn'} note="70–180 mg/dL target"/>
          <KpiTile label="Medication adherence" value={stats.adherence===null?'–':Math.round(stats.adherence).toString()} unit="%" tone={stats.adherence===null?'neutral':stats.adherence>=85?'good':'danger'} note="of logged days this week"/>
          <KpiTile label="Logging streak" value={streak.toString()} unit={streak===1?'day':'days'} tone={streak>=5?'good':'neutral'} note={`${stats.loggedDays} of 7 days logged`}/>
        </div>

        {/* ── HABIT RINGS ───────────────────────────────────────────────────── */}
        <Sec title="Weekly habits" action={<Link to="/check-ins" style={{ fontSize:11,color:'var(--accent)',fontWeight:600 }}>See all</Link>}>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8 }}>
            <HabitRing label="Steps" value={stats.avgSteps} max={STEP_GOAL} unit="avg" color="#0d9488" sublabel={`Goal ${(STEP_GOAL/1000).toFixed(0)}k`}/>
            <HabitRing label="Water" value={stats.avgWater!==null?stats.avgWater/1000:null} max={WATER_GOAL_ML/1000} unit="L" color="#0ea5e9" sublabel={`Goal ${(WATER_GOAL_ML/1000).toFixed(1)}L`}/>
            <HabitRing label="Sleep" value={stats.avgSleep} max={SLEEP_GOAL_HOURS} unit="h" color="#a78bfa" sublabel={`Goal ${SLEEP_GOAL_HOURS}h`}/>
            <HabitRing label="Stress" value={todayStress!==null?10-todayStress:null} max={10} unit="calm" color="#f472b6" sublabel="Inverted — higher = calmer"/>
          </div>
        </Sec>

        {/* ── MEDICATION STREAK ─────────────────────────────────────────────── */}
        <Sec title="Medication streak" action={<span style={{ fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:stats.adherence!==null&&stats.adherence>=85?'rgba(16,185,129,.15)':'rgba(245,158,11,.15)',color:stats.adherence!==null&&stats.adherence>=85?'#10b981':'#f59e0b' }}>{stats.adherence!==null?`${Math.round(stats.adherence)}% adherence`:'No data'}</span>}>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6 }}>
            {days.map(day=>{
              const entry=week.find(c=>c.date===day); const taken=entry?.meds_taken;
              const dayLabel=new Date(day+'T12:00:00').toLocaleDateString('en',{ weekday:'short' });
              const isToday=day===today;
              return (
                <div key={day} onClick={()=>navigate('/check-ins')} style={{ borderRadius:10,padding:'10px 4px',textAlign:'center',cursor:'pointer',background:taken===true?'rgba(16,185,129,.15)':taken===false?'rgba(239,68,68,.1)':'var(--bg-card-2,var(--bg-card))',border:`${isToday?'2px':'1px'} solid ${taken===true?'rgba(16,185,129,.4)':taken===false?'rgba(239,68,68,.3)':'var(--border)'}` }}>
                  <p style={{ fontSize:9,fontWeight:600,color:'var(--text-muted)',marginBottom:5 }}>{dayLabel}</p>
                  <div style={{ fontSize:18,lineHeight:1 }}>{taken===true?'💊':taken===false?'✗':'○'}</div>
                  <p style={{ fontSize:9,marginTop:5,fontWeight:600,color:taken===true?'#10b981':taken===false?'#ef4444':'var(--text-muted)' }}>{taken===true?'Taken':taken===false?'Missed':'–'}</p>
                </div>
              );
            })}
          </div>
        </Sec>

        {/* ── GLUCOSE HEATMAP ───────────────────────────────────────────────── */}
        <Sec title="Blood sugar · 7-day heatmap" action={
          <div style={{ display:'flex',gap:8,alignItems:'center' }}>
            {[{ label:'In range',color:'#10b981' },{ label:'Watch',color:'#f59e0b' },{ label:'High',color:'#ef4444' }].map(l=>(
              <span key={l.label} style={{ display:'flex',alignItems:'center',gap:4,fontSize:10,color:'var(--text-muted)' }}>
                <span style={{ width:8,height:8,borderRadius:2,background:l.color,display:'inline-block' }}/>{l.label}
              </span>
            ))}
          </div>
        }>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6 }}>
            {days.map(day=>{
              const entry=week.find(c=>c.date===day); const glucose=entry?.glucose_fasting??null;
              const tone=glucose===null?'none':glucose<=GLUCOSE.FASTING_MAX?'good':glucose<=180?'warn':'danger';
              const bg=tone==='good'?'rgba(16,185,129,.18)':tone==='warn'?'rgba(245,158,11,.18)':tone==='danger'?'rgba(239,68,68,.18)':'var(--bg-card-2,var(--bg-card))';
              const border=tone==='good'?'rgba(16,185,129,.35)':tone==='warn'?'rgba(245,158,11,.35)':tone==='danger'?'rgba(239,68,68,.35)':'var(--border)';
              const tc=tone==='good'?'#10b981':tone==='warn'?'#f59e0b':tone==='danger'?'#ef4444':'var(--text-muted)';
              const dayLabel=new Date(day+'T12:00:00').toLocaleDateString('en',{ weekday:'short' });
              return (
                <div key={day} style={{ borderRadius:10,padding:'10px 6px',textAlign:'center',background:bg,border:`1px solid ${border}` }}>
                  <p style={{ fontSize:10,fontWeight:600,color:'var(--text-muted)',marginBottom:4 }}>{dayLabel}</p>
                  <p style={{ fontSize:16,fontWeight:800,color:tc,letterSpacing:'-.03em',lineHeight:1 }}>{glucose!==null?glucose:'–'}</p>
                  <p style={{ fontSize:9,color:'var(--text-muted)',marginTop:3 }}>mg/dL</p>
                </div>
              );
            })}
          </div>
        </Sec>

        {/* ── AI INSIGHTS ───────────────────────────────────────────────────── */}
        <div style={{ padding:'16px 20px',borderRadius:18,background:'linear-gradient(135deg,rgba(192,132,252,.08),rgba(129,140,248,.08))',border:'1px solid rgba(192,132,252,.2)' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
            <div style={{ display:'flex',alignItems:'center',gap:8 }}>
              <Sparkles style={{ width:16,height:16,color:'#c084fc' }}/>
              <p style={{ fontSize:12,fontWeight:700,color:'var(--text-muted)',letterSpacing:'.08em',textTransform:'uppercase' }}>AI Insights</p>
            </div>
          </div>
          {insights.length===0
            ? <p style={{ fontSize:13,color:'var(--text-secondary)' }}>Patterns appear after a few days of logs.</p>
            : <ul style={{ display:'flex',flexDirection:'column',gap:8 }}>
                {insights.slice(0,3).map((ins,i)=>(
                  <li key={i} style={{ display:'flex',gap:8,fontSize:13,color:'var(--text-secondary)',lineHeight:1.4 }}>
                    <span style={{ marginTop:5,width:6,height:6,borderRadius:'50%',flexShrink:0,background:ins.tone==='positive'?'#10b981':'#f59e0b' }}/>
                    {ins.text}
                  </li>
                ))}
              </ul>
          }
          <Link to="/ai-summary" style={{ marginTop:14,display:'inline-flex',alignItems:'center',gap:6,fontSize:12,fontWeight:700,color:'#c084fc',textDecoration:'none' }}>
            <Sparkles style={{ width:13,height:13 }}/>Generate full AI summary
          </Link>
        </div>

        {/* ── QUICK ACCESS ──────────────────────────────────────────────────── */}
        <div>
          <p style={{ fontSize:11,fontWeight:700,color:'var(--text-muted)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:10 }}>Quick access</p>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10 }}>
            {[
              { icon:FileText, label:'Health Vault',  sub:'Records & emergency info',  to:'/documents', color:'#60a5fa' },
              { icon:Watch,    label:'Wearables',     sub:'Connect & sync devices',     to:'/wearables', color:'#4ade80' },
              { icon:Users,    label:'Family',        sub:'Profiles & sharing',         to:'/family',    color:'#fbbf24' },
              { icon:Target,   label:'Goals',         sub:'Active health targets',      to:'/goals',     color:'#a78bfa' },
            ].map(q=>(
              <Link key={q.to} to={q.to} style={{ display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderRadius:14,background:'var(--bg-card)',border:'1px solid var(--border)',textDecoration:'none' }}>
                <div style={{ width:36,height:36,borderRadius:10,flexShrink:0,background:`${q.color}18`,display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <q.icon style={{ width:17,height:17,color:q.color }}/>
                </div>
                <div>
                  <p style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{q.label}</p>
                  <p style={{ fontSize:11,color:'var(--text-muted)' }}>{q.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <p style={{ fontSize:11,color:'var(--text-muted)',textAlign:'center' }}>Targets are defaults for adults with Type 2 Diabetes. This app does not replace medical advice.</p>
      </>)}

      {showEmergency && <EmergencyModal onClose={()=>setShowEmergency(false)}/>}
    </div>
  );
}
