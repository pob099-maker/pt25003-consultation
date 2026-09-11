import { useMemo, useState } from 'react';
import { Layout } from '../../components/Layout';
import { accentPanel, card, primaryButton, secondaryButton, textInput } from '../../components/ui';
import { useQuestionnaire } from '../../contexts/QuestionnaireContext';
import { interestLabel, roleLabel } from '../../content/lookup';
import { downloadCsv } from '../../lib/csv';
import { contactsCsv, freeTextCsv, responsesCsv } from '../../services/exportCsv';
import { freeTextEntries, overview, rankConstraints, rateAreas, tallyMulti } from '../../services/analysis';
import { THEME_TAGS, saveTags, tagKey } from '../../services/tags';
import { useAdminData } from './useAdminData';
import { RoundEditor } from './RoundEditor';

const percent = (share: number): string => `${Math.round(share * 100)}%`;

const Stat = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div className={card}>
    <p className="text-meta text-ink-soft">{label}</p>
    <p className="mt-1 text-title font-bold text-ink">{value}</p>
    {note !== undefined && <p className="mt-1 text-meta text-ink-faint">{note}</p>}
  </div>
);

const Bar = ({ share }: { share: number }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunk" aria-hidden="true">
    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, Math.round(share * 100))}%` }} />
  </div>
);

export const AdminDashboard = ({ onSignOut }: { onSignOut: () => void }) => {
  const questionnaire = useQuestionnaire();
  const data = useAdminData();
  const [roleFilter, setRoleFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [includeTest, setIncludeTest] = useState(data.demoMode);
  const [tab, setTab] = useState<'priorities' | 'comments' | 'contacts' | 'rounds'>('priorities');

  const filtered = useMemo(
    () =>
      data.responses.filter((response) => {
        if (!includeTest && response.isTestData) return false;
        if (roleFilter !== 'all' && response.role !== roleFilter) return false;
        if (regionFilter !== 'all' && !response.regions.includes(regionFilter)) return false;
        return true;
      }),
    [data.responses, includeTest, roleFilter, regionFilter],
  );

  const contacts = useMemo(
    () => data.contacts.filter((contact) => includeTest || !contact.isTestData),
    [data.contacts, includeTest],
  );

  const stats = useMemo(() => overview(questionnaire, filtered), [questionnaire, filtered]);
  const ranked = useMemo(() => rankConstraints(questionnaire, filtered, 'q2_top_three'), [questionnaire, filtered]);
  const mentioned = useMemo(() => tallyMulti(questionnaire, filtered, 'q1_constraints'), [questionnaire, filtered]);
  const areas = useMemo(() => rateAreas(questionnaire, filtered, 'q5_areas'), [questionnaire, filtered]);
  const evidence = useMemo(() => tallyMulti(questionnaire, filtered, 'q7_evidence'), [questionnaire, filtered]);
  const comments = useMemo(() => freeTextEntries(questionnaire, filtered), [questionnaire, filtered]);

  const toggleTag = async (responseId: string, questionId: string, tag: string): Promise<void> => {
    const key = tagKey(responseId, questionId);
    const current = data.tags[key] ?? [];
    const next = current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag];
    data.setTags(await saveTags(responseId, questionId, next, data.tags));
  };

  // What people volunteered for, counted. This is the list the project works
  // from when it comes to filling the reference group or finding a trial host.
  const interestTally = useMemo(() => {
    const counts = new Map<string, number>();
    for (const contact of contacts) {
      for (const id of contact.interests) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ id, label: interestLabel(questionnaire, id), count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [contacts, questionnaire]);

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <Layout>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1>Consultation results</h1>
        <button type="button" className="text-meta text-primary underline underline-offset-4" onClick={onSignOut}>
          Sign out
        </button>
      </div>
      <p className="mt-2 text-meta text-ink-soft">
        {questionnaire.roundLabel}. Contact details are listed separately and are not linked to any set of answers.
      </p>

      {data.demoMode && (
        <p className={`${accentPanel} mt-5 text-body`} role="status">
          No backend is configured, so this screen is showing the seeded <strong>test data</strong> that ships with the
          app. Set the Supabase environment variables to see real responses.
        </p>
      )}
      {data.error !== null && (
        <p className={`${card} mt-5 border-danger text-body text-danger`} role="alert">
          {data.error}
        </p>
      )}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Overview">
        <Stat label="Responses" value={String(stats.total)} note={includeTest ? 'Includes test data' : 'Real responses only'} />
        <Stat label="Reached the final section" value={percent(stats.completionRate)} />
        <Stat label="Median time taken" value={`${stats.medianMinutes} min`} />
        <Stat label="Contact records" value={String(contacts.length)} note="Opted in to follow-up" />
      </section>

      <section className={`${card} mt-5 grid gap-4 sm:grid-cols-3`} aria-label="Filters">
        <div>
          <label htmlFor="filter-role" className="mb-1 block text-meta font-semibold text-ink-soft">
            Role
          </label>
          <select id="filter-role" className={textInput} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">All roles</option>
            {questionnaire.roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-region" className="mb-1 block text-meta font-semibold text-ink-soft">
            Region
          </label>
          <select id="filter-region" className={textInput} value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
            <option value="all">All regions</option>
            {questionnaire.regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={includeTest}
              onChange={(event) => setIncludeTest(event.target.checked)}
            />
            Include test data
          </label>
        </div>
      </section>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Sections">
        {(
          [
            ['priorities', 'Priorities'],
            ['comments', `Comments (${comments.length})`],
            ['contacts', `Contacts (${contacts.length})`],
            ['rounds', 'Question wording'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
            className={`rounded-md border px-4 py-2 text-body min-h-11 ${
              tab === id ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {data.loading && <p className="mt-6 text-ink-soft">Loading responses…</p>}

      {!data.loading && tab === 'priorities' && (
        <div className="mt-6 grid gap-6">
          <section className={card}>
            <h2 className="text-subtitle font-semibold">Ranked constraints</h2>
            <p className="mt-1 text-meta text-ink-soft">
              Weighted score gives 3 points to a first choice, 2 to a second and 1 to a third.
            </p>
            <table className="mt-3 w-full text-body">
              <thead>
                <tr className="border-b border-line text-left text-meta text-ink-soft">
                  <th scope="col" className="py-2">Constraint</th>
                  <th scope="col" className="py-2 text-right">Score</th>
                  <th scope="col" className="py-2 text-right">1st</th>
                  <th scope="col" className="py-2 text-right">Named</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-normal">{row.label}</th>
                    <td className="py-2 text-right font-semibold">{row.weightedScore}</td>
                    <td className="py-2 text-right">{row.firstChoices}</td>
                    <td className="py-2 text-right">{row.count}</td>
                  </tr>
                ))}
                {ranked.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-3 text-ink-faint">Nothing ranked yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className={card}>
            <h2 className="text-subtitle font-semibold">Priority areas, mean rating</h2>
            <ol className="mt-3 grid gap-3">
              {areas.map((area) => (
                <li key={area.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span>{area.label}</span>
                    <span className="shrink-0 text-meta text-ink-soft">
                      {area.mean.toFixed(2)} · {percent(area.highPriorityShare)} rated 4–5
                    </span>
                  </div>
                  <div className="mt-1">
                    <Bar share={area.mean / 5} />
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className={card}>
              <h2 className="text-subtitle font-semibold">Constraints named</h2>
              <ul className="mt-3 grid gap-2 text-body">
                {mentioned.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3">
                    <span>{row.label}</span>
                    <span className="text-ink-soft">{row.count} · {percent(row.share)}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className={card}>
              <h2 className="text-subtitle font-semibold">Evidence that would build confidence</h2>
              <ul className="mt-3 grid gap-2 text-body">
                {evidence.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3">
                    <span>{row.label}</span>
                    <span className="text-ink-soft">{row.count} · {percent(row.share)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className={card}>
            <h2 className="text-subtitle font-semibold">Who responded</h2>
            <div className="mt-3 grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="text-meta font-semibold uppercase tracking-wide text-ink-faint">By role</h3>
                <ul className="mt-2 grid gap-1 text-body">
                  {stats.byRole.map((row) => (
                    <li key={row.id} className="flex justify-between gap-3">
                      <span>{row.label}</span>
                      <span className="text-ink-soft">{row.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-meta font-semibold uppercase tracking-wide text-ink-faint">By region</h3>
                <ul className="mt-2 grid gap-1 text-body">
                  {stats.byRegion.map((row) => (
                    <li key={row.id} className="flex justify-between gap-3">
                      <span>{row.label}</span>
                      <span className="text-ink-soft">{row.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      )}

      {!data.loading && tab === 'comments' && (
        <div className="mt-6 grid gap-4">
          {comments.map((entry) => {
            const applied = data.tags[tagKey(entry.responseId, entry.questionId)] ?? [];
            return (
              <article key={`${entry.responseId}-${entry.questionId}`} className={card}>
                <p className="text-meta text-ink-faint">
                  {roleLabel(questionnaire, entry.role)} · {entry.submittedAt.slice(0, 10)}
                </p>
                <h3 className="mt-1 text-meta font-semibold text-ink-soft">{entry.questionPrompt}</h3>
                <p className="mt-2 whitespace-pre-wrap text-body">{entry.text}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {THEME_TAGS.map((theme) => {
                    const on = applied.includes(theme);
                    return (
                      <button
                        key={theme}
                        type="button"
                        aria-pressed={on}
                        onClick={() => void toggleTag(entry.responseId, entry.questionId, theme)}
                        className={`rounded-full border px-3 py-1.5 text-meta ${
                          on ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink-soft'
                        }`}
                      >
                        {theme}
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
          {comments.length === 0 && <p className="text-ink-soft">No free-text comments in this selection.</p>}
        </div>
      )}

      {!data.loading && tab === 'contacts' && (
        <div className="mt-6 grid gap-4">
          <p className="text-meta text-ink-soft">
            These records exist only because somebody asked to be contacted. They carry no link to any consultation
            answers.
          </p>
          {interestTally.length > 0 && (
            <section className={card}>
              <h2 className="text-subtitle font-semibold">What people volunteered for</h2>
              <ul className="mt-3 grid gap-2 text-body">
                {interestTally.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3">
                    <span>{row.label}</span>
                    <span className="text-ink-soft">{row.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {contacts.map((contact) => (
            <article key={contact.id} className={card}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-subtitle font-semibold">{contact.name.trim().length > 0 ? contact.name : 'No name given'}</h3>
                <span className="text-meta text-ink-faint">{contact.submittedAt.slice(0, 10)}</span>
              </div>
              <p className="text-meta text-ink-soft">
                {[contact.organisation, contact.broadRole, contact.region].filter((part) => part.trim().length > 0).join(' · ')}
              </p>
              <p className="mt-2 text-body">
                {contact.email.trim().length > 0 && (
                  <a className="underline underline-offset-4" href={`mailto:${contact.email}`}>
                    {contact.email}
                  </a>
                )}
                {contact.email.trim().length > 0 && contact.phone.trim().length > 0 && ' · '}
                {contact.phone}
              </p>
              <p className="mt-2 text-meta text-ink-soft">
                Interested in: {contact.interests.map((id) => interestLabel(questionnaire, id)).join(', ')}
              </p>
              {contact.preferredContactTime.trim().length > 0 && (
                <p className="mt-1 text-meta text-ink-soft">Best time: {contact.preferredContactTime}</p>
              )}
              {contact.comments.trim().length > 0 && <p className="mt-2 text-body">{contact.comments}</p>}
            </article>
          ))}
          {contacts.length === 0 && <p className="text-ink-soft">No contact records yet.</p>}
        </div>
      )}

      {!data.loading && tab === 'rounds' && <RoundEditor />}

      <section className="mt-8 flex flex-wrap gap-3 no-print" aria-label="Exports">
        <button
          type="button"
          className={primaryButton}
          onClick={() => downloadCsv(`pt25003-responses-${stamp}.csv`, responsesCsv(questionnaire, filtered))}
        >
          Export responses (CSV)
        </button>
        <button
          type="button"
          className={secondaryButton}
          onClick={() => downloadCsv(`pt25003-contacts-${stamp}.csv`, contactsCsv(questionnaire, contacts))}
        >
          Export contacts and EOI (CSV)
        </button>
        <button
          type="button"
          className={secondaryButton}
          onClick={() =>
            downloadCsv(
              `pt25003-comments-${stamp}.csv`,
              freeTextCsv(comments, data.tags, (role) => roleLabel(questionnaire, role)),
            )
          }
        >
          Export comments and themes (CSV)
        </button>
        <button type="button" className={secondaryButton} onClick={data.reload}>
          Refresh
        </button>
      </section>
    </Layout>
  );
};
