import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { accentPanel, card, primaryButton, secondaryButton, textInput } from '../components/ui';
import { useQuestionnaire } from '../contexts/QuestionnaireContext';
import { useStaffSession } from '../hooks/useStaffSession';
import { groupQuestions, handsMeaning, loadGroups, optionsForGroup, saveGroup, type GroupRecord } from '../services/groups';
import { AdminLogin } from './admin/AdminLogin';

/** Keeps what was typed, so "" stays "not asked" and never turns into 0. */
type Draft = Readonly<Record<string, string>>;

const parseCount = (raw: string | undefined): number | undefined | 'invalid' => {
  if (raw === undefined || raw.trim() === '') return undefined;
  return /^\d{1,3}$/.test(raw.trim()) ? Number(raw.trim()) : 'invalid';
};

const today = (): string => new Date().toISOString().slice(0, 10);

const GroupForm = ({ staffId, existing }: { staffId: string; existing: GroupRecord | null }) => {
  const questionnaire = useQuestionnaire();
  const navigate = useNavigate();
  const questions = useMemo(() => groupQuestions(questionnaire), [questionnaire]);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [region, setRegion] = useState(existing?.region ?? '');
  const [heldOn, setHeldOn] = useState(existing?.heldOn ?? today());
  const [present, setPresent] = useState(existing === null ? '' : String(existing.present));
  const [roles, setRoles] = useState<Draft>(() =>
    Object.fromEntries(Object.entries(existing?.roles ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const [counts, setCounts] = useState<Draft>(() => {
    const flat: Record<string, string> = {};
    for (const [questionId, options] of Object.entries(existing?.counts ?? {})) {
      for (const [optionId, hands] of Object.entries(options)) flat[`${questionId}::${optionId}`] = String(hands);
    }
    return flat;
  });
  const [notes, setNotes] = useState<Draft>(existing?.notes ?? {});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const presentNumber = parseCount(present);

  const save = async (): Promise<void> => {
    setError(null);
    if (typeof presentNumber !== 'number') {
      setError('Enter how many people were in the room.');
      return;
    }
    const structured: Record<string, Record<string, number>> = {};
    for (const [key, raw] of Object.entries(counts)) {
      const value = parseCount(raw);
      if (value === undefined) continue;
      const [questionId, optionId] = key.split('::');
      if (value === 'invalid' || questionId === undefined || optionId === undefined) {
        setError('Counts are whole numbers of people. Leave a box empty if that was not asked.');
        return;
      }
      structured[questionId] = { ...(structured[questionId] ?? {}), [optionId]: value };
    }
    const roleCounts: Record<string, number> = {};
    for (const [role, raw] of Object.entries(roles)) {
      const value = parseCount(raw);
      if (value === 'invalid') {
        setError('The numbers of each role are whole numbers.');
        return;
      }
      if (value !== undefined) roleCounts[role] = value;
    }
    const record: GroupRecord = {
      id: existing?.id ?? crypto.randomUUID(),
      roundId: existing?.roundId ?? questionnaire.roundId,
      title,
      region,
      heldOn,
      present: presentNumber,
      roles: roleCounts,
      counts: structured,
      notes: Object.fromEntries(Object.entries(notes).filter(([, text]) => text.trim().length > 0)),
      collectedBy: existing?.collectedBy ?? staffId,
      updatedAt: new Date().toISOString(),
    };
    setSaving(true);
    const result = await saveGroup(record);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    navigate('/admin?tab=groups');
  };

  return (
    <div className="grid gap-5">
      <section className={accentPanel}>
        <p className="text-body text-ink">
          A room is recorded as a room. Count hands, and leave a box <strong>empty</strong> for anything the group
          wasn&rsquo;t asked — an empty box means &ldquo;not asked&rdquo;, a <strong>0</strong> means &ldquo;asked,
          and nobody&rdquo;.
        </p>
        <p className="mt-2 text-meta text-ink-soft">
          These totals are reported beside the individual responses and never added to them. Twelve hands are not
          twelve responses.
        </p>
      </section>

      <section className={`${card} grid gap-4 sm:grid-cols-2`} aria-label="The meeting">
        <div className="sm:col-span-2">
          <label htmlFor="group-title" className="mb-1 block text-body font-medium">
            Group
          </label>
          <input
            id="group-title"
            className={textInput}
            placeholder="For example: Ballarat grower group"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="group-region" className="mb-1 block text-body font-medium">
            Region
          </label>
          <input id="group-region" className={textInput} value={region} onChange={(e) => setRegion(e.target.value)} />
        </div>
        <div>
          <label htmlFor="group-date" className="mb-1 block text-body font-medium">
            Held on
          </label>
          <input
            id="group-date"
            type="date"
            className={textInput}
            value={heldOn}
            onChange={(e) => setHeldOn(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="group-present" className="mb-1 block text-body font-medium">
            People in the room
          </label>
          <input
            id="group-present"
            inputMode="numeric"
            className={textInput}
            value={present}
            aria-invalid={presentNumber === 'invalid'}
            onChange={(e) => setPresent(e.target.value)}
          />
        </div>
      </section>

      <details className={card}>
        <summary className="cursor-pointer text-body font-semibold text-ink">
          Who was there, roughly <span className="font-normal text-ink-soft">— optional</span>
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {questionnaire.roles.map((role) => (
            <div key={role.id}>
              <label htmlFor={`role-${role.id}`} className="mb-1 block text-meta text-ink-soft">
                {role.label}
              </label>
              <input
                id={`role-${role.id}`}
                inputMode="numeric"
                className={textInput}
                value={roles[role.id] ?? ''}
                onChange={(e) => setRoles({ ...roles, [role.id]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </details>

      {questions.map((question) => {
        const options = optionsForGroup(question);
        return (
          <section key={question.id} className={card} aria-labelledby={`gq-${question.id}`}>
            <h2 id={`gq-${question.id}`} className="text-subtitle font-semibold text-ink">
              {question.guide?.open ?? question.prompt}
            </h2>
            <p className="mt-1 text-meta text-ink-soft">{handsMeaning(question)}</p>
            {options.length > 0 && (
              <ul className="mt-3 grid gap-2">
                {options.map((option) => {
                  const key = `${question.id}::${option.id}`;
                  const parsed = parseCount(counts[key]);
                  const over = typeof parsed === 'number' && typeof presentNumber === 'number' && parsed > presentNumber;
                  return (
                    <li key={option.id} className="flex items-center justify-between gap-3">
                      <label htmlFor={key} className="text-body text-ink">
                        {option.label}
                      </label>
                      <input
                        id={key}
                        inputMode="numeric"
                        className={`${textInput} w-20 text-right`}
                        value={counts[key] ?? ''}
                        aria-invalid={parsed === 'invalid' || over}
                        onChange={(e) => setCounts({ ...counts, [key]: e.target.value })}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
            <label htmlFor={`note-${question.id}`} className="mt-3 mb-1 block text-meta text-ink-soft">
              {question.kind === 'text' ? 'What the room said' : 'Anything said that the numbers miss'}
            </label>
            <textarea
              id={`note-${question.id}`}
              rows={question.kind === 'text' ? 4 : 2}
              className={textInput}
              value={notes[question.id] ?? ''}
              onChange={(e) => setNotes({ ...notes, [question.id]: e.target.value })}
            />
          </section>
        );
      })}

      {error !== null && (
        <p role="alert" className="rounded-md border border-danger px-4 py-3 text-body text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" className={primaryButton} disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save the group record'}
        </button>
        <Link to="/admin?tab=groups" className={secondaryButton}>
          Cancel
        </Link>
      </div>
    </div>
  );
};

/** Record a regional grower-group discussion, or correct one already recorded. */
export const GroupRecordPage = () => {
  const staff = useStaffSession();
  const { id } = useParams();
  const [existing, setExisting] = useState<GroupRecord | null | 'loading'>(id === undefined ? null : 'loading');

  useEffect(() => {
    if (id === undefined || staff.userId === null) return;
    void loadGroups().then((records) => setExisting(records.find((record) => record.id === id) ?? null));
  }, [id, staff.userId]);

  if (staff.checking) {
    return (
      <Layout>
        <p className="text-ink-soft">Checking your sign-in…</p>
      </Layout>
    );
  }
  if (staff.userId === null) return <AdminLogin onSignedIn={staff.refresh} />;

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h1>Group discussion</h1>
        <Link to="/admin?tab=groups" className="text-meta text-primary-ink underline underline-offset-4">
          Admin area
        </Link>
      </div>
      {existing === 'loading' ? (
        <p className="text-ink-soft">Loading…</p>
      ) : (
        <GroupForm staffId={staff.userId} existing={existing} />
      )}
    </Layout>
  );
};
