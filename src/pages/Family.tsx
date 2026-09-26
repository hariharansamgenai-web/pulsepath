import { useState } from 'react';
import { Eye, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useActiveProfile } from '@/context/ActiveProfileContext';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Loading } from '@/components/feedback/Loading';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { RELATIONSHIP_LABELS, SEX_LABELS, ageFrom, deleteProfile } from '@/lib/profiles';
import { formatDate } from '@/lib/utils';
import type { Profile } from '@/types';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; profile: Profile }
  | { kind: 'view'; profile: Profile }
  | { kind: 'delete'; profile: Profile }
  | null;

export function FamilyPage() {
  const { profiles, activeProfile, selfProfile, loading, error, refresh, setActiveProfileId } = useActiveProfile();
  const { refreshProfile } = useAuth();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const family = profiles.filter((p) => p.relationship !== 'self');

  async function afterSave(saved: Profile, created: boolean) {
    setDialog(null);
    await refresh();
    if (saved.relationship === 'self') await refreshProfile();
    if (created) setActiveProfileId(saved.id);
  }

  async function confirmDelete(profile: Profile) {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteProfile(profile);
      if (activeProfile?.id === profile.id && selfProfile) setActiveProfileId(selfProfile.id);
      setDialog(null);
      await refresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete the profile.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading && profiles.length === 0) return <Loading label="Loading profiles" />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Family profiles</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Keep health records for the people you care for. Each profile’s records are kept separate.
          </p>
        </div>
        <Button onClick={() => setDialog({ kind: 'create' })}>
          <Plus className="h-4 w-4" />
          Add family member
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((p) => (
          <ProfileCard
            key={p.id}
            profile={p}
            active={p.id === activeProfile?.id}
            onSwitch={() => setActiveProfileId(p.id)}
            onView={() => setDialog({ kind: 'view', profile: p })}
            onEdit={() => setDialog({ kind: 'edit', profile: p })}
            onDelete={p.relationship === 'self' ? undefined : () => { setDeleteError(null); setDialog({ kind: 'delete', profile: p }); }}
          />
        ))}
      </div>

      {family.length === 0 && (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No family members yet"
          description="Add a spouse, parent or child to track their check-ins, activity and records alongside yours."
          action={
            <Button variant="outline" onClick={() => setDialog({ kind: 'create' })}>
              <Plus className="h-4 w-4" />
              Add family member
            </Button>
          }
        />
      )}

      <Modal open={dialog?.kind === 'create'} onClose={() => setDialog(null)} title="Add family member" size="lg">
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <ProfileForm onSaved={(p) => afterSave(p, true)} onCancel={() => setDialog(null)} />
        </div>
      </Modal>

      <Modal
        open={dialog?.kind === 'edit'}
        onClose={() => setDialog(null)}
        title={dialog?.kind === 'edit' ? `Edit ${dialog.profile.display_name}` : ''}
        size="lg"
      >
        {dialog?.kind === 'edit' && (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <ProfileForm key={dialog.profile.id} profile={dialog.profile} onSaved={(p) => afterSave(p, false)} onCancel={() => setDialog(null)} />
          </div>
        )}
      </Modal>

      <Modal open={dialog?.kind === 'view'} onClose={() => setDialog(null)} title="Profile" size="md"
        footer={dialog?.kind === 'view' ? (
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Close</Button>
            <Button variant="outline" onClick={() => setDialog({ kind: 'edit', profile: dialog.profile })}>Edit</Button>
            {dialog.profile.id !== activeProfile?.id && (
              <Button onClick={() => { setActiveProfileId(dialog.profile.id); setDialog(null); }}>Show their records</Button>
            )}
          </>
        ) : undefined}
      >
        {dialog?.kind === 'view' && <ProfileDetails profile={dialog.profile} />}
      </Modal>

      <Modal
        open={dialog?.kind === 'delete'}
        onClose={() => setDialog(null)}
        title={dialog?.kind === 'delete' ? `Delete ${dialog.profile.display_name}’s profile?` : ''}
        size="sm"
        footer={dialog?.kind === 'delete' ? (
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>Keep profile</Button>
            <Button variant="danger" loading={deleting} onClick={() => confirmDelete(dialog.profile)}>Delete profile</Button>
          </>
        ) : undefined}
      >
        {dialog?.kind === 'delete' && (
          <>
            <p className="text-sm text-neutral-700">
              All of {dialog.profile.display_name}’s health records will be permanently deleted: check-ins, activities,
              goals, nutrition logs, medical documents and summaries. This can’t be undone.
            </p>
            {deleteError && <p className="mt-3 text-sm text-error-600">{deleteError}</p>}
          </>
        )}
      </Modal>
    </div>
  );
}

function ProfileCard({
  profile,
  active,
  onSwitch,
  onView,
  onEdit,
  onDelete,
}: {
  profile: Profile;
  active: boolean;
  onSwitch: () => void;
  onView: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const age = ageFrom(profile.date_of_birth);
  const facts = [
    age !== null ? `${age} yrs` : null,
    profile.height_cm !== null ? `${profile.height_cm} cm` : null,
    profile.weight_kg !== null ? `${profile.weight_kg} kg` : null,
  ].filter(Boolean);

  return (
    <Card className={active ? 'ring-2 ring-primary-500' : undefined}>
      <div className="flex items-start gap-3">
        <ProfileAvatar profile={profile} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-neutral-900">{profile.display_name}</p>
          <p className="text-sm text-neutral-600">{RELATIONSHIP_LABELS[profile.relationship]}</p>
          {facts.length > 0 && <p className="mt-1 text-xs text-neutral-500">{facts.join(', ')}</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {active ? (
          <Badge variant="primary">Showing now</Badge>
        ) : (
          <Button size="sm" variant="outline" onClick={onSwitch}>
            Show records
          </Button>
        )}
        <div className="ml-auto flex gap-1">
          <IconButton label={`View ${profile.display_name}`} onClick={onView}><Eye className="h-4 w-4" /></IconButton>
          <IconButton label={`Edit ${profile.display_name}`} onClick={onEdit}><Pencil className="h-4 w-4" /></IconButton>
          {onDelete && (
            <IconButton label={`Delete ${profile.display_name}`} onClick={onDelete} danger>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          )}
        </div>
      </div>
    </Card>
  );
}

function IconButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        danger
          ? 'rounded-md p-2 text-neutral-500 hover:bg-error-50 hover:text-error-600'
          : 'rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
      }
    >
      {children}
    </button>
  );
}

export function ProfileDetails({ profile }: { profile: Profile }) {
  const age = ageFrom(profile.date_of_birth);
  const rows: [string, string][] = [
    ['Relationship', RELATIONSHIP_LABELS[profile.relationship]],
    ['Date of birth', profile.date_of_birth ? `${formatDate(profile.date_of_birth + 'T00:00:00')}${age !== null ? ` (${age} yrs)` : ''}` : 'Not set'],
    ['Gender', profile.sex ? SEX_LABELS[profile.sex] : 'Not set'],
    ['Height', profile.height_cm !== null ? `${profile.height_cm} cm` : 'Not set'],
    ['Weight', profile.weight_kg !== null ? `${profile.weight_kg} kg` : 'Not set'],
  ];
  return (
    <div>
      <div className="mb-5 flex items-center gap-4">
        <ProfileAvatar profile={profile} size="lg" className="!h-16 !w-16 !text-lg" />
        <p className="text-lg font-semibold text-neutral-900">{profile.display_name}</p>
      </div>
      <dl className="space-y-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-neutral-100 pb-2 last:border-0">
            <dt className="text-neutral-600">{k}</dt>
            <dd className="text-right font-medium text-neutral-900">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
