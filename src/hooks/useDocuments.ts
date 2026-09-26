import { useCallback, useEffect, useState } from 'react';
import type { DocumentCategory, MedicalDocument } from '@/types';
import { listDocuments } from '@/lib/documents';

interface UseDocumentsOptions {
  profileId: string | null | undefined;
  category?: DocumentCategory;
  search?: string;
}

export function useDocuments({ profileId, category, search }: UseDocumentsOptions) {
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!profileId) { setDocuments([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setDocuments(await listDocuments(profileId, { category, search }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load documents.');
    } finally {
      setLoading(false);
    }
  }, [profileId, category, search]);

  useEffect(() => { reload(); }, [reload]);
  return { documents, loading, error, reload };
}
