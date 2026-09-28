import { currentProject } from '../../content/projects';
import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { isBackendConfigured } from '../../lib/config';
import { CONTACTS_TABLE, RESPONSES_TABLE } from '../../services/submit';
import { fromContactRow, fromResponseRow, type ContactRow, type ResponseRow } from '../../services/records';
import { seedContacts } from '../../services/seed';
import { demoResponses } from '../../services/demoData';
import { loadTags, type TagMap } from '../../services/tags';
import { loadProgress, type ProgressRow } from '../../services/progress';
import { fetchAllRounds, type RoundConfig } from '../../services/rounds';
import type { ConsultationResponse, ContactRecord } from '../../types';

export interface AdminData {
  readonly responses: readonly ConsultationResponse[];
  readonly contacts: readonly ContactRecord[];
  readonly tags: TagMap;
  readonly progress: readonly ProgressRow[];
  /** Every round, oldest first. Loaded with everything else, so Refresh reloads them too. */
  readonly rounds: readonly RoundConfig[];
  /** Why the rounds could not be read, when they could not. */
  readonly roundsError: string | null;
  readonly loading: boolean;
  readonly error: string | null;
  /** True when there is no backend, so the screen is showing seeded test data. */
  readonly demoMode: boolean;
  readonly reload: () => void;
  /** Reads the rounds again without reloading everything else, after one is saved. */
  readonly reloadRounds: () => Promise<void>;
  readonly setTags: (tags: TagMap) => void;
}

export const useAdminData = (): AdminData => {
  const demoMode = !isBackendConfigured();
  const [responses, setResponses] = useState<readonly ConsultationResponse[]>([]);
  const [contacts, setContacts] = useState<readonly ContactRecord[]>([]);
  const [tags, setTags] = useState<TagMap>({});
  const [progress, setProgress] = useState<readonly ProgressRow[]>([]);
  const [rounds, setRounds] = useState<readonly RoundConfig[]>([]);
  const [roundsError, setRoundsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  const reloadRounds = useCallback(async () => {
    const result = await fetchAllRounds();
    if (result.success) {
      setRounds(result.data);
      setRoundsError(null);
    } else {
      setRoundsError(result.error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      if (demoMode) {
        const demoRounds = await fetchAllRounds();
        if (!cancelled) {
          setResponses(demoResponses(currentProject().questionnaire));
          setContacts(seedContacts());
          setRounds(demoRounds.success ? demoRounds.data : []);
          setRoundsError(null);
          setTags(await loadTags());
          setLoading(false);
        }
        return;
      }
      const supabase = getSupabase();
      if (supabase === null) return;
      const [responseResult, contactResult, loadedTags, loadedProgress, loadedRounds] = await Promise.all([
        supabase
          .from(RESPONSES_TABLE)
          .select('*')
          .eq('project_id', currentProject().id)
          .order('submitted_at', { ascending: false }),
        supabase
          .from(CONTACTS_TABLE)
          .select('*')
          .eq('project_id', currentProject().id)
          .order('submitted_at', { ascending: false }),
        loadTags(),
        loadProgress(),
        fetchAllRounds(),
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
      setContacts(contactResult.error === null ? (contactResult.data as ContactRow[]).map(fromContactRow) : []);
      setTags(loadedTags);
      setProgress(loadedProgress);
      setRounds(loadedRounds.success ? loadedRounds.data : []);
      setRoundsError(loadedRounds.success ? null : loadedRounds.error);
      setLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [demoMode, nonce]);

  return {
    responses,
    contacts,
    tags,
    progress,
    rounds,
    roundsError,
    loading,
    error,
    demoMode,
    reload,
    reloadRounds,
    setTags,
  };
};
