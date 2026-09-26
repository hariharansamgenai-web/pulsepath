import { useRef, useState, type FormEvent } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import {
  ALLOWED_MIME_TYPES,
  formatFileSize,
  MAX_FILE_SIZE_BYTES,
  PRIMARY_CATEGORIES,
  CATEGORY_LABELS,
  uploadDocument,
  validateFile,
} from '@/lib/documents';
import { todayISO } from '@/lib/health';
import type { DocumentCategory, MedicalDocument } from '@/types';

interface DocumentUploadFormProps {
  userId: string;
  profileId: string;
  onUploaded: (doc: MedicalDocument) => void;
  onCancel?: () => void;
}

export function DocumentUploadForm({ userId, profileId, onUploaded, onCancel }: DocumentUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [category, setCategory] = useState<DocumentCategory>('other');
  const [documentName, setDocumentName] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [doctor, setDoctor] = useState('');
  const [hospitalClinic, setHospitalClinic] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function handleFileChange(files: FileList | null) {
    const f = files?.[0] ?? null;
    setFile(null);
    setFileError(null);
    if (!f) return;
    const err = validateFile(f);
    if (err) { setFileError(err); return; }
    setFile(f);
    if (!documentName) setDocumentName(f.name.replace(/\.[^.]+$/, ''));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) { setFileError('Choose a file to upload.'); return; }
    setUploading(true);
    setUploadError(null);
    try {
      const doc = await uploadDocument(userId, profileId, file, {
        category,
        document_name: documentName,
        document_date: documentDate || null,
        doctor,
        hospital_clinic: hospitalClinic,
        notes,
      });
      onUploaded(doc);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={(e) => { e.preventDefault(); handleFileChange(e.dataTransfer.files); }}
        onDragOver={(e) => e.preventDefault()}
        className="cursor-pointer rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-6 py-8 text-center transition-colors hover:border-primary-400 hover:bg-primary-50"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(',')}
          className="sr-only"
          onChange={(e) => handleFileChange(e.target.files)}
        />
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-neutral-900">{file.name}</p>
              <p className="text-xs text-neutral-500">{formatFileSize(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFile(null); setDocumentName(''); }}
              className="rounded-full p-1 text-neutral-500 hover:bg-neutral-200"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-8 w-8 text-neutral-400" />
            <p className="mt-2 text-sm font-medium text-neutral-700">Click to browse or drag and drop</p>
            <p className="mt-1 text-xs text-neutral-500">
              PDF, JPG, JPEG, PNG · Max {formatFileSize(MAX_FILE_SIZE_BYTES)}
            </p>
          </>
        )}
      </div>
      {fileError && <p role="alert" className="text-sm text-error-600">{fileError}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Document name"
          name="document_name"
          placeholder="e.g. HbA1c July 2026"
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
          helperText="Optional — date on the document"
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
        placeholder="Anything worth noting about this document"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {uploadError && (
        <p role="alert" className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">{uploadError}</p>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={uploading} disabled={!file}>
          <Upload className="h-4 w-4" />
          Upload document
        </Button>
      </div>
    </form>
  );
}
