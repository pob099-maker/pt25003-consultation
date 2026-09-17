import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { isBackendConfigured } from '../lib/config';

/**
 * A stand-in staff id for demo mode, where there is no backend to sign in to.
 * It only ever reaches the local outbox, never a database.
 */
export const DEMO_STAFF_ID = '00000000-0000-4000-a000-000000000001';

export interface StaffSession {
  readonly checking: boolean;
  /** The signed-in staff member, or null. Interviews are recorded against this. */
  readonly userId: string | null;
  readonly email: string | null;
  readonly refresh: () => void;
  readonly signOut: () => Promise<void>;
}

/** Who is signed in on a staff screen. Respondents never pass through here. */
export const useStaffSession = (): StaffSession => {
  const demo = !isBackendConfigured();
  const [checking, setChecking] = useState(!demo);
  const [userId, setUserId] = useState<string | null>(demo ? DEMO_STAFF_ID : null);
  const [email, setEmail] = useState<string | null>(demo ? 'demo@example.invalid' : null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const supabase = getSupabase();
    if (supabase === null) return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setUserId(data.session?.user.id ?? null);
      setEmail(data.session?.user.email ?? null);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
    setUserId(null);
    setEmail(null);
  }, []);

  return { checking, userId, email, refresh, signOut };
};
