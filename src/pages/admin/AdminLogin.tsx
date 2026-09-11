import { useState } from 'react';
import { Layout } from '../../components/Layout';
import { card, primaryButton, textInput } from '../../components/ui';
import { getSupabase } from '../../lib/supabase';

export const AdminLogin = ({ onSignedIn }: { onSignedIn: () => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const supabase = getSupabase();
    if (supabase === null) {
      setError('No backend is configured for this deployment.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError !== null) {
      setError('That email address and password did not match an administrator account.');
      return;
    }
    onSignedIn();
  };

  return (
    <Layout>
      <h1>Project administration</h1>
      <p className="prose-measure mt-3 text-ink-soft">
        For project staff only. Respondents never need an account.
      </p>
      <form className={`${card} mt-6 grid max-w-sm gap-4`} onSubmit={(event) => void signIn(event)} noValidate>
        <div>
          <label htmlFor="admin-email" className="mb-1 block text-body font-medium">
            Email address
          </label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            className={textInput}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="admin-password" className="mb-1 block text-body font-medium">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            className={textInput}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {error !== null && (
          <p role="alert" className="text-meta font-medium text-danger">
            {error}
          </p>
        )}
        <button type="submit" className={primaryButton} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </Layout>
  );
};
