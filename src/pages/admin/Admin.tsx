import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { isBackendConfigured } from '../../lib/config';
import { AdminLogin } from './AdminLogin';
import { AdminDashboard } from './AdminDashboard';
import { Layout } from '../../components/Layout';

export const Admin = () => {
  // With no backend there is nothing to sign in to, and nothing real to
  // protect: the screen shows the seeded test data so the area can be
  // demonstrated and reviewed before the project is created.
  const [signedIn, setSignedIn] = useState(!isBackendConfigured());
  const [checking, setChecking] = useState(isBackendConfigured());

  useEffect(() => {
    const supabase = getSupabase();
    if (supabase === null) return;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSignedIn(data.session !== null);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = async (): Promise<void> => {
    await getSupabase()?.auth.signOut();
    setSignedIn(false);
  };

  if (checking) {
    return (
      <Layout>
        <p className="text-ink-soft">Checking your sign-in…</p>
      </Layout>
    );
  }

  return signedIn ? (
    <AdminDashboard onSignOut={() => void signOut()} />
  ) : (
    <AdminLogin onSignedIn={() => setSignedIn(true)} />
  );
};
