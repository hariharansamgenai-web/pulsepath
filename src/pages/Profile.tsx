import { useState } from 'react';
import { CheckCircle2, Eye, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useActiveProfile } from '@/context/ActiveProfileContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Loading } from '@/components/feedback/Loading';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { RELATIONSHIP_LABELS, SEX_LABELS, ageFrom, deleteProfile } from '@/lib/profiles';
import { formatDate } from '@/lib/utils';
import type { Profile } from '@/types';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; profile: Profile }
  | { kind: 'view'; profile: Profile }
  | { kind: 'delete'; profile: Profile }
  | null;

type Tab = 'profile' | 'family';

export function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const { selfProfile, profiles, activeProfile, loading, error, refresh, setActiveProfileId } = useActiveProfile();
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<Tab>('profile');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const family = profiles.filter(p => p.relationship !== 'self');

  async function afterSave(saved: Profile) {
    setDialog(null);
    await refresh();
    if (saved.relationship === 'self') await refreshProfile();
    setActiveProfileId(saved.id);
  }

  async function confirmDelete(profile: Profile) {
    setDeleting(true); setDeleteError(null);
    try {
      await deleteProfile(profile);
      if (activeProfile?.id === profile.id && selfProfile) setActiveProfileId(selfProfile.id);
      setDialog(null); await refresh();
    } catch (e) { setDeleteError(e instanceof Error ? e.message : 'Could not delete.'); }
    finally { setDeleting(false); }
  }

  if (loading && !selfProfile) return <Loading label="Loading profile" />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!selfProfile) return <ErrorState message="Profile not found. Sign out and back in." onRetry={refresh} />;

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
    border: 'none', transition: 'all .18s',
    background: tab === t ? 'var(--accent)' : 'transparent',
    color: tab === t ? '#fff' : 'var(--text-secondary)',
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-.02em' }}>
            {tab === 'profile' ? 'My profile' : 'Family & profiles'}
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {tab === 'profile'
              ? `Signed in as ${user?.email}`
              : 'Manage family members — each has separate health records.'}
          </p>
        </div>
        {tab === 'family' && (
          <Button onClick={() => setDialog({ kind: 'create' })}>
            <Plus className="h-4 w-4" /> Add family member
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', width: 'fit-content' }}>
        <button style={tabStyle('profile')} onClick={() => setTab('profile')}>
          My profile
        </button>
        <button style={tabStyle('family')} onClick={() => setTab('family')}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users style={{ width: 13, height: 13 }} />
            Family
            {family.length > 0 && (
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: tab === 'family' ? 'rgba(255,255,255,.3)' : 'var(--accent-bg)', color: tab === 'family' ? '#fff' : 'var(--accent)', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {family.length}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* ── Tab: My Profile ── */}
      {tab === 'profile' && (
        <Card>
          <CardHeader title="Personal details" subtitle="Used to personalise your dashboard and summaries." className="mb-6" />
          <ProfileForm
            key={selfProfile.updated_at}
            profile={selfProfile}
            onSaved={async () => {
              await refresh(); await refreshProfile();
              setSaved(true); setTimeout(() => setSaved(false), 3000);
            }}
          />
          {saved && (
            <p role="status" className="mt-4 flex items-center gap-2 text-sm" style={{ color: 'var(--good-text)' }}>
              <CheckCircle2 className="h-4 w-4" /> Profile saved.
            </p>
          )}
        </Card>
      )}

      {/* ── Tab: Family ── */}
      {tab === 'family' && (
        <div className="space-y-4">
          {profiles.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Users className="h-6 w-6" />}
                title="No family members yet"
                description="Add a family member to track their health records separately."
                action={<Button onClick={() => setDialog({ kind: 'create' })}><Plus className="h-4 w-4" />Add family member</Button>}
              />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {profiles.map(p => (
                <ProfileCard
                  key={p.id}
                  profile={p}
                  active={p.id === activeProfile?.id}
                  onSwitch={() => setActiveProfileId(p.id)}
                  onView={() => setDialog({ kind: 'view', profile: p })}
                  onEdit={() => setDialog({ kind: 'edit', profile: p })}
                  onDelete={() => { setDeleteError(null); setDialog({ kind: 'delete', profile: p }); }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      <Modal open={dialog?.kind === 'create'} onClose={() => setDialog(null)} title="Add family member" size="lg">
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <ProfileForm onSaved={afterSave} onCancel={() => setDialog(null)} />
        </div>
      </Modal>

      <Modal open={dialog?.kind === 'edit'} onClose={() => setDialog(null)} title="Edit profile" size="lg">
        {dialog?.kind === 'edit' && (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <ProfileForm key={dialog.profile.id} profile={dialog.profile} onSaved={afterSave} onCancel={() => setDialog(null)} />
          </div>
        )}
      </Modal>

      <Modal open={dialog?.kind === 'view'} onClose={() => setDialog(null)}
        title={dialog?.kind === 'view' ? dialog.profile.display_name : ''} size="sm">
        {dialog?.kind === 'view' && <ProfileDetails profile={dialog.profile} />}
      </Modal>

      <Modal open={dialog?.kind === 'delete'} onClose={() => setDialog(null)}
        title="Remove this profile?" size="sm"
        footer={dialog?.kind === 'delete' ? (
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Keep</Button>
            <Button variant="danger" loading={deleting} onClick={() => dialog?.kind === 'delete' && confirmDelete(dialog.profile)}>Remove</Button>
          </>
        ) : undefined}>
        {dialog?.kind === 'delete' && (
          <>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              "{dialog.profile.display_name}" and all their health records will be permanently deleted.
            </p>
            {deleteError && <p className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>{deleteError}</p>}
          </>
        )}
      </Modal>
    </div>
  );
}

// ── Profile card ──────────────────────────────────────────────────────────────
function ProfileCard({ profile, active, onSwitch, onView, onEdit, onDelete }: {
  profile: Profile; active: boolean;
  onSwitch: () => void; onView: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const isSelf = profile.relationship === 'self';
  const age = profile.date_of_birth ? ageFrom(profile.date_of_birth) : null;

  return (
    <Card className={active ? 'ring-2 ring-accent' : ''}>
      <div className="flex items-start gap-3">
        <ProfileAvatar profile={profile} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              {profile.display_name}
            </p>
            <Badge variant={isSelf ? 'primary' : 'neutral'}>
              {isSelf ? 'Me' : RELATIONSHIP_LABELS[profile.relationship] ?? profile.relationship}
            </Badge>
            {active && <Badge variant="success">Active</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            {age !== null && <span>{age} yrs</span>}
            {profile.sex && <span>{SEX_LABELS[profile.sex] ?? profile.sex}</span>}
            {profile.date_of_birth && <span>DOB {formatDate(profile.date_of_birth)}</span>}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {!active && (
          <Button size="sm" variant="outline" onClick={onSwitch}>Switch to</Button>
        )}
        <Button size="sm" variant="ghost" onClick={onView}>
          <Eye className="h-3.5 w-3.5" />View
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />Edit
        </Button>
        {!isSelf && (
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />Remove
          </Button>
        )}
      </div>
    </Card>
  );
}

// ── Profile detail view ───────────────────────────────────────────────────────
function ProfileDetails({ profile }: { profile: Profile }) {
  const rows = [
    { label: 'Relationship', value: profile.relationship === 'self' ? 'Me' : RELATIONSHIP_LABELS[profile.relationship] ?? profile.relationship },
    { label: 'Date of birth', value: profile.date_of_birth ? formatDate(profile.date_of_birth) : '–' },
    { label: 'Age', value: profile.date_of_birth ? `${ageFrom(profile.date_of_birth)} years` : '–' },
    { label: 'Sex', value: profile.sex ? (SEX_LABELS[profile.sex] ?? profile.sex) : '–' },
    { label: 'Height', value: profile.height_cm ? `${profile.height_cm} cm` : '–' },
    { label: 'Weight', value: profile.weight_kg ? `${profile.weight_kg} kg` : '–' },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <ProfileAvatar profile={profile} size="lg" />
        <div>
          <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{profile.display_name}</p>
          <Badge variant="neutral">{RELATIONSHIP_LABELS[profile.relationship] ?? profile.relationship}</Badge>
        </div>
      </div>
      <div className="divide-y" style={{ '--divide-color': 'var(--border)' } as React.CSSProperties}>
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between py-2">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{r.label}</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
