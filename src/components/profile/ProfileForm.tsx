import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import {
  FAMILY_RELATIONSHIPS,
  RELATIONSHIP_LABELS,
  SEX_LABELS,
  createProfile,
  removeAvatar,
  setAvatar,
  updateProfile,
  validateAvatar,
} from '@/lib/profiles';
import type { Profile, Relationship, Sex } from '@/types';

interface ProfileFormProps {
  /** Existing profile to edit; omit to create a new family profile. */
  profile?: Profile | null;
  onSaved: (profile: Profile) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

type Errors = Partial<Record<'display_name' | 'relationship' | 'date_of_birth' | 'height_cm' | 'weight_kg' | 'photo', string>>;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ProfileForm({ profile, onSaved, onCancel, submitLabel }: ProfileFormProps) {
  const isSelf = profile?.relationship === 'self';
  const [name, setName] = useState(profile?.display_name ?? '');
  const [relationship, setRelationship] = useState<Relationship | ''>(profile?.relationship ?? '');
  const [dob, setDob] = useState(profile?.date_of_birth ?? '');
  const [sex, setSex] = useState<Sex | ''>(profile?.sex ?? '');
  const [height, setHeight] = useState(profile?.height_cm?.toString() ?? '');
  const [weight, setWeight] = useState(profile?.weight_kg?.toString() ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const relationshipOptions = (isSelf ? (['self'] as Relationship[]) : FAMILY_RELATIONSHIPS).map((r) => ({
    value: r,
    label: RELATIONSHIP_LABELS[r],
  }));
  // Keep a legacy 'parent' value selectable when editing old rows.
  if (profile?.relationship === 'parent') relationshipOptions.push({ value: 'parent', label: RELATIONSHIP_LABELS.parent });

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    const invalid = validateAvatar(file);
    setErrors((e) => ({ ...e, photo: invalid ?? undefined }));
    if (invalid) return;
    setPhoto(file);
    setRemovePhoto(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Errors = {};
    const trimmed = name.trim();
    if (!trimmed) errs.display_name = 'Enter a name.';
    else if (trimmed.length > 60) errs.display_name = 'Keep the name under 60 characters.';
    if (!relationship) errs.relationship = 'Choose a relationship.';
    if (dob && dob > today()) errs.date_of_birth = 'Date of birth can’t be in the future.';
    const h = height.trim() === '' ? null : Number(height);
    const w = weight.trim() === '' ? null : Number(weight);
    if (h !== null && (Number.isNaN(h) || h < 30 || h > 250)) errs.height_cm = 'Height must be between 30 and 250 cm.';
    if (w !== null && (Number.isNaN(w) || w < 1 || w > 400)) errs.weight_kg = 'Weight must be between 1 and 400 kg.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const input = {
        display_name: trimmed,
        relationship: relationship as Relationship,
        date_of_birth: dob || null,
        sex: (sex || null) as Sex | null,
        height_cm: h,
        weight_kg: w,
      };
      let saved = profile ? await updateProfile(profile.id, input) : await createProfile(input);
      if (photo) saved = await setAvatar(saved, photo);
      else if (removePhoto && saved.avatar_url) saved = await removeAvatar(saved);
      onSaved(saved);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the profile.');
    } finally {
      setSaving(false);
    }
  }

  const avatarSource = { display_name: name || profile?.display_name || '?', avatar_url: removePhoto ? null : profile?.avatar_url ?? null };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="flex items-center gap-4">
        <ProfileAvatar profile={avatarSource} previewUrl={photoPreview} size="lg" className="!h-16 !w-16 !text-lg" />
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Camera className="h-4 w-4" />
              {profile?.avatar_url || photo ? 'Change photo' : 'Add photo'}
            </Button>
            {(photo || (profile?.avatar_url && !removePhoto)) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPhoto(null);
                  setRemovePhoto(true);
                  if (fileRef.current) fileRef.current.value = '';
                }}
              >
                <X className="h-4 w-4" />
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-neutral-500">JPG, PNG or WebP, up to 2 MB. Only you can see it.</p>
          {errors.photo && <p className="text-sm text-error-600">{errors.photo}</p>}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Profile photo"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" name="display_name" value={name} error={errors.display_name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <Select
          label="Relationship"
          name="relationship"
          value={relationship}
          placeholder={isSelf ? undefined : 'Choose…'}
          options={relationshipOptions}
          disabled={isSelf}
          helperText={isSelf ? 'This is your own profile.' : undefined}
          error={errors.relationship}
          onChange={(e) => setRelationship(e.target.value as Relationship)}
        />
        <Input label="Date of birth" name="date_of_birth" type="date" max={today()} value={dob} error={errors.date_of_birth} onChange={(e) => setDob(e.target.value)} />
        <Select
          label="Gender"
          name="sex"
          value={sex}
          placeholder="Not set"
          options={(Object.keys(SEX_LABELS) as Sex[]).map((s) => ({ value: s, label: SEX_LABELS[s] }))}
          onChange={(e) => setSex(e.target.value as Sex | '')}
        />
        <Input label="Height (cm)" name="height_cm" type="number" inputMode="decimal" min={30} max={250} value={height} error={errors.height_cm} onChange={(e) => setHeight(e.target.value)} />
        <Input label="Weight (kg)" name="weight_kg" type="number" inputMode="decimal" step="0.1" min={1} max={400} value={weight} error={errors.weight_kg} onChange={(e) => setWeight(e.target.value)} />
      </div>

      {saveError && (
        <p role="alert" className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">
          {saveError}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={saving}>
          {submitLabel ?? (profile ? 'Save changes' : 'Create profile')}
        </Button>
      </div>
    </form>
  );
}
