import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Layout } from '../../components/Layout';
import { card, primaryButton, quietButton, textInput } from '../../components/ui';
import { getSupabase } from '../../lib/supabase';

const signInSchema = z.object({
  email: z.string().trim().email('Enter the email address you were invited with.'),
  password: z.string().min(1, 'Enter your password.'),
});

const resetSchema = z.object({
  email: z.string().trim().email('Enter the email address you were invited with.'),
});

type SignInValues = z.infer<typeof signInSchema>;
type ResetValues = z.infer<typeof resetSchema>;

const ResetForm = ({ onBack }: { onBack: () => void }) => {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { email: '' } });

  const send = async (values: ResetValues): Promise<void> => {
    const supabase = getSupabase();
    if (supabase === null) return;
    await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/#/set-password`,
    });
    // The same message whether or not the address has an account, so this form
    // cannot be used to find out who is on the team.
    setSent(true);
  };

  if (sent) {
    return (
      <section className={`${card} mt-6 grid max-w-sm gap-3`} role="status">
        <p className="text-body text-ink">
          If that address belongs to the project team, an email with a reset link is on its way.
        </p>
        <p className="text-meta text-ink-soft">The link works once, for about an hour. Check the junk folder too.</p>
        <button type="button" className={quietButton} onClick={onBack}>
          Back to sign in
        </button>
      </section>
    );
  }

  return (
    <form className={`${card} mt-6 grid max-w-sm gap-4`} onSubmit={handleSubmit(send)} noValidate>
      <p className="text-meta text-ink-soft">We&rsquo;ll email you a link to choose a new password.</p>
      <div>
        <label htmlFor="reset-email" className="mb-1 block text-body font-medium">
          Email address
        </label>
        <input
          id="reset-email"
          type="email"
          autoComplete="username"
          className={textInput}
          aria-invalid={errors.email !== undefined}
          aria-describedby={errors.email === undefined ? undefined : 'reset-email-error'}
          {...register('email')}
        />
        {errors.email !== undefined && (
          <p id="reset-email-error" className="mt-1 text-meta font-medium text-danger">
            {errors.email.message}
          </p>
        )}
      </div>
      <button type="submit" className={primaryButton} disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send the reset link'}
      </button>
      <button type="button" className={quietButton} onClick={onBack}>
        Back to sign in
      </button>
    </form>
  );
};

export const AdminLogin = ({ onSignedIn }: { onSignedIn: () => void }) => {
  const [mode, setMode] = useState<'signin' | 'reset'>('signin');
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } });

  const signIn = async (values: SignInValues): Promise<void> => {
    const supabase = getSupabase();
    if (supabase === null) {
      setError('No backend is configured for this deployment.');
      return;
    }
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword(values);
    if (signInError !== null) {
      setError('That email address and password did not match a project team account.');
      return;
    }
    onSignedIn();
  };

  return (
    <Layout>
      <h1>Project team</h1>
      <p className="prose-measure mt-3 text-ink-soft">For project staff only. Respondents never need an account.</p>

      {mode === 'reset' ? (
        <ResetForm onBack={() => setMode('signin')} />
      ) : (
        <form className={`${card} mt-6 grid max-w-sm gap-4`} onSubmit={handleSubmit(signIn)} noValidate>
          <div>
            <label htmlFor="admin-email" className="mb-1 block text-body font-medium">
              Email address
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              className={textInput}
              aria-invalid={errors.email !== undefined}
              aria-describedby={errors.email === undefined ? undefined : 'admin-email-error'}
              {...register('email')}
            />
            {errors.email !== undefined && (
              <p id="admin-email-error" className="mt-1 text-meta font-medium text-danger">
                {errors.email.message}
              </p>
            )}
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
              aria-invalid={errors.password !== undefined}
              aria-describedby={errors.password === undefined ? undefined : 'admin-password-error'}
              {...register('password')}
            />
            {errors.password !== undefined && (
              <p id="admin-password-error" className="mt-1 text-meta font-medium text-danger">
                {errors.password.message}
              </p>
            )}
          </div>
          {error !== null && (
            <p role="alert" className="text-meta font-medium text-danger">
              {error}
            </p>
          )}
          <button type="submit" className={primaryButton} disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
          <button type="button" className={`${quietButton} justify-self-start`} onClick={() => setMode('reset')}>
            Forgot your password?
          </button>
        </form>
      )}
    </Layout>
  );
};
