import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { updateDocument, PRIMARY_CATEGORIES, CATEGORY_LABELS } from '@/lib/documents';
import { todayISO } from '@/lib/health';
import type { DocumentCategory, MedicalDocument, MedicalDocumentInput } from '@/types';

interface DocumentEditFormProps {
  document: MedicalDocument;
  onSaved: (doc: MedicalDocument) => void;
  onCancel?: () => void;
}

export function DocumentEditForm({ document, onSaved, onCancel }: DocumentEditFormProps) {
  const [documentName, setDocumentName] = useState(document.document_name ?? document.file_name);
  const [category, setCategory] = useState<DocumentCategory>(document.category);
  const [documentDate, setDocumentDate] = useState(document.document_date ?? '');
  const [doctor, setDoctor] = useState(document.doctor ?? '');
  const [hospitalClinic, setHospitalClinic] = useState(document.hospital_clinic ?? '');
  const [notes, setNotes] = useState(document.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setDocumentName(document.document_name ?? document.file_name);
    setCategory(document.category);
    setDocumentDate(document.document_date ?? '');
    setDoctor(document.doctor ?? '');
    setHospitalClinic(document.hospital_clinic ?? '');
    setNotes(document.notes ?? '');
    setSaveError(null);
  }, [document]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!documentName.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const input: Partial<MedicalDocumentInput> = {
        category,
        document_name: documentName.trim(),
        document_date: documentDate || null,
        doctor: doctor.trim() || null,
        hospital_clinic: hospitalClinic.trim() || null,
        notes: notes.trim() || null,
      };
      const updated = await updateDocument(document.id, document.profile_id, input);
      onSaved(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Document name"
          name="document_name"
          value={documentName}
          onChange={(e) => setDocumentName(e.target.value)}
        />
        <Select
          label="Category"
          name="category"
          value={category}
          options={PRIMARY_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
          onChange={(e) => setCategory(e.target.value as DocumentCategory)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Document date"
          name="document_date"
          type="date"
          max={todayISO()}
          value={documentDate}
          onChange={(e) => setDocumentDate(e.target.value)}
        />
        <Input
          label="Doctor"
          name="doctor"
          placeholder="Optional"
          value={doctor}
          onChange={(e) => setDoctor(e.target.value)}
        />
      </div>

      <Input
        label="Hospital / Clinic"
        name="hospital_clinic"
        placeholder="Optional"
        value={hospitalClinic}
        onChange={(e) => setHospitalClinic(e.target.value)}
      />

      <Textarea
        label="Notes"
        name="notes"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {saveError && <p role="alert" className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">{saveError}</p>}

      <div className="flex flex-wrap justify-end gap-3">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={saving}>Save changes</Button>
      </div>
    </form>
  );
}
