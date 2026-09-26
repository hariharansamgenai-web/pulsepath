import { useState } from 'react';
import {
  AlertCircle, Check, CheckCircle2, Clock, Copy, Link2,
  Plus, RefreshCw, Share2, ShieldCheck, Trash2, XCircle,
} from 'lucide-react';
import { useActiveProfile } from '@/context/ActiveProfileContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/feedback/Loading';
import { useShares } from '@/hooks/useShares';
import {
  createShare, deleteShare,
  RESOURCE_TYPE_LABELS, revokeShare, shareUrl,
  STATUS_LABELS, type CreateShareInput,
} from '@/lib/sharing';
import type { MedicalShareWithDocuments, ShareResourceType, ShareStatus } from '@/types';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<ShareStatus, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  active:  { bg: 'var(--good-bg)',   text: 'var(--good-text)',   icon: CheckCircle2 },
  pending: { bg: 'var(--warn-bg)',   text: 'var(--warn-text)',   icon: Clock },
  revoked: { bg: 'var(--danger-bg)', text: 'var(--danger-text)', icon: XCircle },
  expired: { bg: 'var(--danger-bg)', text: 'var(--danger-text)', icon: AlertCircle },
};

function StatusBadge({ status }: { status: ShareStatus }) {
  const s = STATUS_STYLES[status];
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: s.bg, color: s.text }}>
      <Icon className="h-3 w-3" />{STATUS_LABELS[status]}
    </span>
  );
}

function CreateShareForm({ profileId, onCreated, onCancel }: {
  profileId: string; onCreated: () => void; onCancel: () => void;
}) {
  const [email, setEmail]   = useState('');
  const [type, setType]     = useState<ShareResourceType>('all');
  const [label, setLabel]   = useState('');
  const [expiry, setExpiry] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  const resourceTypes: ShareResourceType[] = ['all', 'documents', 'timeline', 'check_ins', 'goals'];
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-input)',
    color: 'var(--text-primary)', fontSize: 14, outline: 'none',
  };
  const labelCss: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
    marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em',
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setErr('Recipient email is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr('Enter a valid email address.'); return; }
    setSaving(true); setErr(null);
    try {
      const input: CreateShareInput = {
        profile_id: profileId, shared_with_email: email,
        resource_type: type, label: label || null,
        expires_at: expiry ? new Date(expiry).toISOString() : null,
      };
      await createShare(input);
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create share.');
    } finally { setSaving(false); }
  }

  return (
    <Card>
      <CardHeader title="New share link" subtitle="The recipient gets a read-only link to the data you choose." className="mb-5" />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label style={labelCss}>Recipient email *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="doctor@clinic.com" style={inputStyle} autoFocus />
        </div>
        <div>
          <label style={labelCss}>What to share</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {resourceTypes.map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={cn('rounded-lg border px-3 py-2 text-sm font-medium text-left transition-all')}
                style={{
                  borderColor: type === t ? 'var(--accent)' : 'var(--border)',
                  background:  type === t ? 'var(--accent-bg)' : 'var(--bg-card)',
                  color:       type === t ? 'var(--accent)' : 'var(--text-secondary)',
                }}>
                {RESOURCE_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelCss}>Label <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. For Dr. Priya – HbA1c results" style={inputStyle} />
        </div>
        <div>
          <label style={labelCss}>Expires <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(blank = never expires)</span></label>
          <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)}
            min={new Date().toISOString().slice(0, 10)} style={inputStyle} />
        </div>
        {err && (
          <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--danger)' }}>
            <AlertCircle className="h-4 w-4 shrink-0" />{err}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="submit" loading={saving}><Link2 className="h-4 w-4" />Create link</Button>
        </div>
      </form>
    </Card>
  );
}

function ShareCard({ share, onRevoke, onDelete }: {
  share: MedicalShareWithDocuments; onRevoke: () => void; onDelete: () => void;
}) {
  const [copied, setCopied]   = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const url = shareUrl(share.share_token);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  async function handleRevoke() {
    setRevoking(true);
    try { await revokeShare(share.id); onRevoke(); } catch { /**/ }
    finally { setRevoking(false); }
  }
  async function handleDelete() {
    if (!confirm('Delete this share? The link will stop working immediately.')) return;
    setDeleting(true);
    try { await deleteShare(share.id); onDelete(); } catch { /**/ }
    finally { setDeleting(false); }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'var(--accent-bg)' }}>
          <Share2 className="h-5 w-5" style={{ color: 'var(--accent)' }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              {share.label || share.shared_with_email}
            </p>
            <StatusBadge status={share.status} />
          </div>
          <div className="space-y-0.5">
            {share.label && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>→ {share.shared_with_email}</p>}
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {RESOURCE_TYPE_LABELS[share.resource_type]}
              {share.share_documents.length > 0 && ` · ${share.share_documents.length} doc${share.share_documents.length > 1 ? 's' : ''}`}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Created {new Date(share.created_at).toLocaleDateString()}
              {share.expires_at ? ` · expires ${new Date(share.expires_at).toLocaleDateString()}` : ' · never expires'}
              {share.access_count > 0 && ` · accessed ${share.access_count}×`}
            </p>
          </div>
          {share.status === 'active' && (
            <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ background: 'var(--bg-card-2, var(--bg-card))', border: '1px solid var(--border)' }}>
              <p className="flex-1 truncate font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{url}</p>
              <button onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold"
                style={{ background: copied ? 'var(--good-bg)' : 'var(--accent-bg)', color: copied ? 'var(--good-text)' : 'var(--accent)' }}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {share.status === 'active' && (
            <Button size="sm" variant="outline" loading={revoking} onClick={handleRevoke}>
              <XCircle className="h-3.5 w-3.5" />Revoke
            </Button>
          )}
          <Button size="sm" variant="ghost" loading={deleting} onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function SharingPage() {
  const { activeProfile } = useActiveProfile();
  const { shares, loading, error, reload } = useShares(activeProfile?.id);
  const [creating, setCreating] = useState(false);

  if (!activeProfile) return <Loading label="Loading profile" />;

  const active   = shares.filter((s) => s.status === 'active');
  const inactive = shares.filter((s) => s.status !== 'active');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-.02em' }}>
            Secure Sharing
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Share {activeProfile.display_name}'s health data with trusted family members or healthcare providers.
          </p>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New share link</Button>
        )}
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
        style={{ background: 'var(--good-bg)', border: '1px solid rgba(16,185,129,.2)' }}>
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--good)' }} />
        <p style={{ color: 'var(--good-text)' }}>
          Share links are read-only and scoped to the data you choose. Links can be revoked at any time.
          Medical documents remain in a private storage bucket — the link never exposes the raw file URL.
        </p>
      </div>

      {/* Create form */}
      {creating && (
        <CreateShareForm
          profileId={activeProfile.id}
          onCreated={() => { setCreating(false); reload(); }}
          onCancel={() => setCreating(false)}
        />
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger-text)' }}>
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
          <Button size="sm" variant="ghost" onClick={reload}><RefreshCw className="h-3.5 w-3.5" />Retry</Button>
        </div>
      )}

      {/* Loading */}
      {loading && <Loading label="Loading shares" />}

      {/* Empty state */}
      {!loading && !error && shares.length === 0 && !creating && (
        <Card className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'var(--accent-bg)' }}>
            <Share2 className="h-7 w-7" style={{ color: 'var(--accent)' }} />
          </div>
          <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>No shares yet</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Create a link to share health data securely with a doctor or family member.
          </p>
          <div className="mt-5">
            <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Create your first share</Button>
          </div>
        </Card>
      )}

      {/* Active */}
      {!loading && active.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-[.1em]" style={{ color: 'var(--text-muted)' }}>
            Active · {active.length}
          </h3>
          {active.map((s) => <ShareCard key={s.id} share={s} onRevoke={reload} onDelete={reload} />)}
        </div>
      )}

      {/* Inactive */}
      {!loading && inactive.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-[.1em]" style={{ color: 'var(--text-muted)' }}>
            Revoked / expired · {inactive.length}
          </h3>
          {inactive.map((s) => <ShareCard key={s.id} share={s} onRevoke={reload} onDelete={reload} />)}
        </div>
      )}
    </div>
  );
}
