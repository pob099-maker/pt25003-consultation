import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config, isBackendConfigured } from './config';

let client: SupabaseClient | null = null;

/**
 * Returns null when no credentials are configured, which is the state of a
 * fresh checkout and of the test run. Callers fall back to the local outbox
 * rather than throwing, so the consultation still works end to end.
 */
export const getSupabase = (): SupabaseClient | null => {
  if (!isBackendConfigured()) return null;
  if (client === null) {
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        // Respondents never sign in. Only the admin area uses auth, and it
        // lives on the same client, so persistence stays on for that.
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return client;
};
