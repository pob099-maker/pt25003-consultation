import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Layout } from '../components/Layout';
import { card, primaryButton, textInput } from '../components/ui';
import { getSupabase } from '../lib/supabase';

const schema = z
  .object({
    password: z.string().min(10, 'Use at least 10 characters.').max(128),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: 'The two passwords do not match.',
    path: ['confirm'],
  });

type Values = z.infer<typeof schema>;

type Status = 'checking' | 'ready' | 'expired' | 'done';

/**
 * Where an invitation or a password-reset email lands.
 *
 * The email carries a one-time token in the query string — ahead of the hash,
 * so it does not collide with the app's hash routing. It is exchanged for a
 * session here and then removed from the address bar, so it is not left in
 * browser history or a bookmark.
 */
export const SetPassword = () => {
  const [status, setStatus] = useState<Status>('checking');
  const [kind, setKind] = useState<'invite' | 'recovery'>('invite');
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });

  useEffect(() => {
    const supabase = getSupabase();
    if (supabase === null) {
      setStatus('expired');
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    const cleanUrl = (): void =>
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);

    let cancelled = false;
    const run = async (): Promise<void> => {
      if (tokenHash !== null && (type === 'invite' || type === 'recovery')) {
        setKind(type);
        const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        cleanUrl();
        if (cancelled) return;
        setStatus(verifyError === null ? 'ready' : 'expired');
        return;
      }
      // A reload after the token was used: carry on if the session survived.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setStatus(data.session !== null ? 'ready' : 'expired');
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (values: Values): Promise<void> => {
    setError(null);
    const supabase = getSupabase();
    if (supabase === null) return;
    const { error: updateError } = await supabase.auth.updateUser({ password: values.password });
    if (updateError !== null) {
      setError(updateError.message);
      return;
    }
    setStatus('done');
  };

  return (
    <Layout>
      <h1>{kind === 'recovery' ? 'Reset your password' : 'Set your password'}</h1>

      {status === 'checking' && <p className="mt-4 text-ink-soft">Checking your link…</p>}

      {status === 'expired' && (
        <section className={`${card} mt-6 max-w-md`}>
          <p className="text-body text-ink">This link has expired or has already been used.</p>
          <p className="mt-2 text-meta text-ink-soft">
            Links work once, for a limited time. Ask whoever invited you to send a new one, or use{' '}
            <Link to="/admin" className="underline underline-offset-4">
              Forgot your password?
            </Link>{' '}
            on the sign-in page.
          </p>
        </section>
      )}

      {status === 'ready' && (
        <form className={`${card} mt-6 grid max-w-md gap-4`} onSubmit={handleSubmit(save)} noValidate>
          <p className="text-meta text-ink-soft">
            {kind === 'invite'
              ? 'Choose a password for the project team area. Only you will know it.'
              : 'Choose a new password.'}
          </p>
          <div>
            <label htmlFor="new-password" className="mb-1 block text-body font-medium">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              className={textInput}
              aria-invalid={errors.password !== undefined}
              aria-describedby={errors.password === undefined ? 'password-hint' : 'password-error'}
              {...register('password')}
            />
            {errors.password === undefined ? (
              <p id="password-hint" className="mt-1 text-meta text-ink-faint">
                At least 10 characters. A few unrelated words is easier to remember than a jumble.
              </p>
            ) : (
              <p id="password-error" className="mt-1 text-meta font-medium text-danger">
                {errors.password.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-body font-medium">
              The same again
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              className={textInput}
              aria-invalid={errors.confirm !== undefined}
              aria-describedby={errors.confirm === undefined ? undefined : 'confirm-error'}
              {...register('confirm')}
            />
            {errors.confirm !== undefined && (
              <p id="confirm-error" className="mt-1 text-meta font-medium text-danger">
                {errors.confirm.message}
              </p>
            )}
          </div>
          {error !== null && (
            <p role="alert" className="text-meta font-medium text-danger">
              {error}
            </p>
          )}
          <button type="submit" className={primaryButton} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save password'}
          </button>
        </form>
      )}

      {status === 'done' && (
        <section className={`${card} mt-6 max-w-md`} role="status">
          <p className="text-body text-ink">Your password is set.</p>
          <p className="mt-2 text-meta text-ink-soft">
            If you cannot see the results yet, ask a project administrator to add you to the team.
          </p>
          <Link to="/admin" className={`${primaryButton} mt-4`}>
            Go to the project team area
          </Link>
        </section>
      )}
    </Layout>
  );
};
