import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { isBackendConfigured } from '../../lib/config';
import { CONTACTS_TABLE, RESPONSES_TABLE } from '../../services/submit';
import { fromContactRow, fromResponseRow, type ContactRow, type ResponseRow } from '../../services/records';
import { seedContacts, seedResponses } from '../../services/seed';
import { loadTags, type TagMap } from '../../services/tags';
import { loadProgress, type ProgressRow } from '../../services/progress';
import type { ConsultationResponse, ContactRecord } from '../../types';

export interface AdminData {
  readonly responses: readonly ConsultationResponse[];
  readonly contacts: readonly ContactRecord[];
  readonly tags: TagMap;
  readonly progress: readonly ProgressRow[];
  readonly loading: boolean;
  readonly error: string | null;
  /** True when there is no backend, so the screen is showing seeded test data. */
  readonly demoMode: boolean;
  readonly reload: () => void;
  readonly setTags: (tags: TagMap) => void;
}

export const useAdminData = (): AdminData => {
  const demoMode = !isBackendConfigured();
  const [responses, setResponses] = useState<readonly ConsultationResponse[]>([]);
  const [contacts, setContacts] = useState<readonly ContactRecord[]>([]);
  const [tags, setTags] = useState<TagMap>({});
  const [progress, setProgress] = useState<readonly ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const run = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      if (demoMode) {
        if (!cancelled) {
          setResponses(seedResponses());
          setContacts(seedContacts());
          setTags(await loadTags());
          setLoading(false);
        }
        return;
      }
      const supabase = getSupabase();
      if (supabase === null) return;
      const [responseResult, contactResult, loadedTags, loadedProgress] = await Promise.all([
        supabase.from(RESPONSES_TABLE).select('*').order('submitted_at', { ascending: false }),
        supabase.from(CONTACTS_TABLE).select('*').order('submitted_at', { ascending: false }),
        loadTags(),
        loadProgress(),
      ]);
      if (cancelled) return;
      if (responseResult.error !== null) {
        setError(responseResult.error.message);
        setLoading(false);
        return;
      }
      setResponses((responseResult.data as ResponseRow[]).map(fromResponseRow));
      // A reader without the contacts policy gets an error here, not a crash:
      // the priorities still render, the contact list simply stays empty.
      setContacts(
        contactResult.error === null ? (contactResult.data as ContactRow[]).map(fromContactRow) : [],
      );
      setTags(loadedTags);
      setProgress(loadedProgress);
      setLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [demoMode, nonce]);

  return { responses, contacts, tags, progress, loading, error, demoMode, reload, setTags };
};
