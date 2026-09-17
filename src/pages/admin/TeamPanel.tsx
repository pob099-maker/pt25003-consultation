import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { accentPanel, card, primaryButton, secondaryButton, textInput } from '../../components/ui';
import { getSupabase } from '../../lib/supabase';
import { isBackendConfigured } from '../../lib/config';
import { useStaffSession } from '../../hooks/useStaffSession';

interface Member {
  readonly userId: string;
  readonly email: string;
  readonly addedAt: string;
}

const addSchema = z.object({ email: z.string().trim().email('Enter their email address.') });
type AddValues = z.infer<typeof addSchema>;

const INVITE_URL = 'https://supabase.com/dashboard/project/ihwwrtfuyhakcjkuaucz/auth/users';

const GRANT_MESSAGE: Readonly<Record<string, string>> = {
  granted: 'Added. They can sign in and see the results now.',
  not_found:
    'There is no account with that address yet. Invite them first (step 1), wait for them to set a password, then add them here.',
};

const REVOKE_MESSAGE: Readonly<Record<string, string>> = {
  revoked: 'Removed. They can still sign in, but will see no results.',
  cannot_remove_self: 'You cannot remove yourself — ask another administrator.',
  last_admin: 'That is the last administrator. Add somebody else first, so the project is never locked out.',
};

/**
 * Who can see the results. Invitations are sent from the Supabase dashboard,
 * because sending one needs a key that must never reach a browser; access is
 * granted here, by email, once the account exists.
 */
export const TeamPanel = () => {
  const { userId: currentUserId } = useStaffSession();
  const [members, setMembers] = useState<readonly Member[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const demo = !isBackendConfigured();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddValues>({ resolver: zodResolver(addSchema), defaultValues: { email: '' } });

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase === null) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('consultation_admins')
      .select('user_id, email, added_at')
      .order('added_at', { ascending: true });
    setMembers(
      ((data ?? []) as { user_id: string; email: string; added_at: string }[]).map((row) => ({
        userId: row.user_id,
        email: row.email,
        addedAt: row.added_at,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (values: AddValues): Promise<void> => {
    const supabase = getSupabase();
    if (supabase === null) return;
    setMessage(null);
    const { data, error } = await supabase.rpc('grant_consultation_admin', { p_email: values.email });
    if (error !== null) {
      setMessage(error.message);
      return;
    }
    setMessage(GRANT_MESSAGE[String(data)] ?? String(data));
    if (data === 'granted') reset();
    await load();
  };

  const remove = async (member: Member): Promise<void> => {
    if (!window.confirm(`Remove ${member.email} from the project team?`)) return;
    const supabase = getSupabase();
    if (supabase === null) return;
    setMessage(null);
    const { data, error } = await supabase.rpc('revoke_consultation_admin', { p_user_id: member.userId });
    setMessage(error !== null ? error.message : (REVOKE_MESSAGE[String(data)] ?? String(data)));
    await load();
  };

  if (demo) {
    return (
      <p className={`${card} mt-6 text-ink-soft`}>
        There is no backend in demo mode, so there is no team to manage.
      </p>
    );
  }

  return (
    <div className="mt-6 grid gap-5">
      <section className={accentPanel}>
        <h2 className="text-subtitle font-semibold">Adding someone to the team</h2>
        <ol className="mt-3 grid list-decimal gap-2 pl-5 text-body text-ink">
          <li>
            In Supabase, choose <strong>Add user → Send invitation</strong> and enter their email.{' '}
            <a className="underline underline-offset-4" href={INVITE_URL} target="_blank" rel="noreferrer">
              Open the Supabase users page
            </a>
            .
          </li>
          <li>They get an email, click the link, and choose their own password. Nobody else ever knows it.</li>
          <li>Add their email below. Until you do, they can sign in but see nothing.</li>
        </ol>
      </section>

      <form className={`${card} grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end`} onSubmit={handleSubmit(add)} noValidate>
        <div>
          <label htmlFor="team-email" className="mb-1 block text-body font-medium">
            Their email address
          </label>
          <input
            id="team-email"
            type="email"
            className={textInput}
            aria-invalid={errors.email !== undefined}
            aria-describedby={errors.email === undefined ? undefined : 'team-email-error'}
            {...register('email')}
          />
          {errors.email !== undefined && (
            <p id="team-email-error" className="mt-1 text-meta font-medium text-danger">
              {errors.email.message}
            </p>
          )}
        </div>
        <button type="submit" className={primaryButton} disabled={isSubmitting}>
          {isSubmitting ? 'Adding…' : 'Add to the team'}
        </button>
      </form>

      {message !== null && (
        <p className={`${card} text-body`} role="status">
          {message}
        </p>
      )}

      <section className={card}>
        <h2 className="text-subtitle font-semibold">The team</h2>
        {loading ? (
          <p className="mt-3 text-ink-soft">Loading…</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {members.map((member) => (
              <li
                key={member.userId}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2 last:border-0"
              >
                <span>
                  <span className="block text-body text-ink">
                    {member.email}
                    {member.userId === currentUserId && <span className="ml-2 text-meta text-ink-faint">(you)</span>}
                  </span>
                  <span className="block text-meta text-ink-faint">Added {member.addedAt.slice(0, 10)}</span>
                </span>
                {member.userId !== currentUserId && (
                  <button type="button" className={secondaryButton} onClick={() => void remove(member)}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
