import { useMemo, useState } from 'react';
import { currentProject } from '../../content/projects';
import { ProjectSwitcher } from './ProjectSwitcher';
import { isDemoSite } from '../../lib/config';
import { DivergingBar, ScaleLegend } from '../../components/DivergingBar';
import { DownloadChartButton } from '../../components/DownloadChartButton';
import { barChartSvg, divergingChartSvg } from '../../lib/chartImage';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { accentPanel, card, primaryButton, secondaryButton, textInput } from '../../components/ui';
import { useQuestionnaire } from '../../contexts/QuestionnaireContext';
import { interestLabel, optionLabel, questionById, roleLabel } from '../../content/lookup';
import { downloadCsv } from '../../lib/csv';
import { contactsCsv, freeTextCsv, responsesCsv } from '../../services/exportCsv';
import {
  freeTextEntries,
  overview,
  rankConstraints,
  rateAreas,
  tallyMulti,
  unpromptedCounts,
} from '../../services/analysis';
import { THEME_TAGS, saveTags, tagKey } from '../../services/tags';
import { summariseProgress } from '../../services/progress';
import { useAdminData } from './useAdminData';
import { RoundEditor } from './RoundEditor';
import { PhoneScriptPanel } from './PhoneScriptPanel';
import { ChangePanel } from './ChangePanel';
import { TeamPanel } from './TeamPanel';
import { GroupsPanel } from './GroupsPanel';

const percent = (share: number): string => `${Math.round(share * 100)}%`;

const TABS = ['priorities', 'change', 'groups', 'comments', 'contacts', 'phone', 'rounds', 'team'] as const;
type Tab = (typeof TABS)[number];
const isTab = (value: string | null): value is Tab => TABS.includes(value as Tab);

const Stat = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div className={card}>
    <p className="text-meta text-ink-soft">{label}</p>
    <p className="mt-1 text-title font-bold text-ink">{value}</p>
    {note !== undefined && <p className="mt-1 text-meta text-ink-faint">{note}</p>}
  </div>
);

export const AdminDashboard = ({ onSignOut }: { onSignOut: () => void }) => {
  const questionnaire = useQuestionnaire();
  const data = useAdminData();
  // Defaults to the round that is collecting now, so a pilot run does not
  // quietly inflate the real numbers once the consultation is live.
  // With no database the responses are the demonstration's own rounds, so start by showing all of them.
  const [roundFilter, setRoundFilter] = useState(data.demoMode ? 'all' : questionnaire.roundId);
  const [roleFilter, setRoleFilter] = useState('all');
  // People tell a person different things than a form, so every figure can be
  // split by how it was collected.
  const [methodFilter, setMethodFilter] = useState<'all' | 'online' | 'interview' | 'workshop'>('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [includeTest, setIncludeTest] = useState(data.demoMode);
  // A link can open a particular tab, e.g. back from recording a group.
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(isTab(requestedTab) ? requestedTab : 'priorities');

  const filtered = useMemo(
    () =>
      data.responses.filter((response) => {
        if (roundFilter !== 'all' && response.roundId !== roundFilter) return false;
        if (methodFilter === 'online' && response.method !== 'online') return false;
        if (methodFilter === 'interview' && !response.method.startsWith('interview_')) return false;
        if (methodFilter === 'workshop' && response.method !== 'workshop') return false;
        if (!includeTest && response.isTestData) return false;
        if (roleFilter !== 'all' && response.role !== roleFilter) return false;
        if (regionFilter !== 'all' && !response.regions.includes(regionFilter)) return false;
        return true;
      }),
    [data.responses, includeTest, roleFilter, regionFilter, roundFilter, methodFilter],
  );

  const contacts = useMemo(
    () =>
      data.contacts.filter(
        (contact) => (roundFilter === 'all' || contact.roundId === roundFilter) && (includeTest || !contact.isTestData),
      ),
    [data.contacts, includeTest, roundFilter],
  );

  /** Every round that has actually collected something, newest label first. */
  const rounds = useMemo(() => {
    const seen = new Set<string>(data.demoMode ? [] : [questionnaire.roundId]);
    for (const response of data.responses) seen.add(response.roundId);
    return [...seen];
  }, [data.responses, data.demoMode, questionnaire.roundId]);

  const stats = useMemo(() => overview(questionnaire, filtered), [questionnaire, filtered]);
  const ranked = useMemo(() => rankConstraints(questionnaire, filtered, 'q2_top_three'), [questionnaire, filtered]);
  const mentioned = useMemo(() => tallyMulti(questionnaire, filtered, 'q1_constraints'), [questionnaire, filtered]);
  const unprompted = useMemo(() => unpromptedCounts(filtered, 'q1_constraints'), [filtered]);
  const areas = useMemo(() => rateAreas(questionnaire, filtered, 'q5_areas'), [questionnaire, filtered]);
  const priorityScale = useMemo((): [string, string] => {
    const question = questionById(questionnaire, 'q5_areas');
    return question?.kind === 'rating'
      ? [question.scale[0]?.label ?? 'Low', question.scale.at(-1)?.label ?? 'High']
      : ['Low', 'High'];
  }, [questionnaire]);
  // What every downloaded chart says about where its numbers came from.
  const chartNote = `${filtered.length} responses · ${currentProject().reference} consultation · ${new Date().toLocaleDateString(
    'en-AU',
    { day: 'numeric', month: 'short', year: 'numeric' },
  )}`;
  const evidence = useMemo(() => tallyMulti(questionnaire, filtered, 'q7_evidence'), [questionnaire, filtered]);
  const trusted = useMemo(() => tallyMulti(questionnaire, filtered, 'q_trust'), [questionnaire, filtered]);
  const trial = useMemo(() => {
    const counts = new Map<string, number>();
    for (const response of filtered) {
      const answer = response.answers['q_trial'];
      if (answer !== undefined && answer.kind === 'single')
        counts.set(answer.value, (counts.get(answer.value) ?? 0) + 1);
    }
    const question = questionById(questionnaire, 'q_trial');
    return [...counts.entries()]
      .map(([id, count]) => ({ id, label: optionLabel(question, id), count }))
      .sort((a, b) => b.count - a.count);
  }, [questionnaire, filtered]);
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

  // Where people stop. Built from the progress table, which holds how far a
  // session got and nothing that was said in it.
  const funnel = useMemo(
    () => summariseProgress(data.progress.filter((row) => roundFilter === 'all' || row.round_id === roundFilter)),
    [data.progress, roundFilter],
  );

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <Layout>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1>Consultation results</h1>
        <span className="flex flex-wrap items-center gap-4">
          <ProjectSwitcher />
          <Link to="/interview" className={primaryButton}>
            Start an interview
          </Link>
          <Link to="/workshop" className={secondaryButton}>
            Run a workshop
          </Link>
          <button type="button" className="text-meta text-primary-ink underline underline-offset-4" onClick={onSignOut}>
            Sign out
          </button>
        </span>
      </div>
      <p className="mt-2 text-meta text-ink-soft">
        {questionnaire.roundLabel}. Contact details are listed separately and are not linked to any set of answers.
      </p>

      {data.demoMode && (
        <p className={`${accentPanel} mt-5 text-body`} role="status">
          {isDemoSite() ? (
            <>
              <strong>This is a demonstration.</strong> Every response here is invented — a baseline of 45 people and a
              mid-project review of 38, collected online, by interview and in workshops — so you can see how the results
              screens work. Try <strong>Change over time</strong>, the <strong>Collected</strong> filter and{' '}
              <strong>Download chart</strong>. Nothing you do here is saved anywhere but this browser.
            </>
          ) : (
            <>
              No backend is configured, so this screen is showing generated <strong>demonstration data</strong>. Set the
              Supabase environment variables to see real responses.
            </>
          )}
        </p>
      )}
      {data.error !== null && (
        <p className={`${card} mt-5 border-danger text-body text-danger`} role="alert">
          {data.error}
        </p>
      )}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Overview">
        <Stat
          label="Responses"
          value={String(stats.total)}
          note={includeTest ? 'Includes test data' : 'Real responses only'}
        />
        <Stat label="Reached the final section" value={percent(stats.completionRate)} />
        <Stat label="Median time taken" value={`${stats.medianMinutes} min`} />
        <Stat label="Contact records" value={String(contacts.length)} note="Opted in to follow-up" />
      </section>

      <section className={`${card} mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5`} aria-label="Filters">
        <div>
          <label htmlFor="filter-method" className="mb-1 block text-meta font-semibold text-ink-soft">
            Collected
          </label>
          <select
            id="filter-method"
            className={textInput}
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as typeof methodFilter)}
          >
            <option value="all">Every way</option>
            <option value="online">Online</option>
            <option value="interview">Interviews</option>
            <option value="workshop">Workshops</option>
          </select>
        </div>
        <div>
          <label htmlFor="filter-round" className="mb-1 block text-meta font-semibold text-ink-soft">
            Consultation
          </label>
          <select
            id="filter-round"
            className={textInput}
            value={roundFilter}
            onChange={(e) => setRoundFilter(e.target.value)}
          >
            <option value="all">All consultations</option>
            {rounds.map((round) => (
              <option key={round} value={round}>
                {round === questionnaire.roundId ? `${round} (collecting now)` : round}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-role" className="mb-1 block text-meta font-semibold text-ink-soft">
            Role
          </label>
          <select
            id="filter-role"
            className={textInput}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
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
          <select
            id="filter-region"
            className={textInput}
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
          >
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
            ['change', 'Change over time'],
            ['groups', 'Groups'],
            ['comments', `Comments (${comments.length})`],
            ['contacts', `Contacts (${contacts.length})`],
            ['phone', 'Phone script'],
            ['rounds', 'Question wording'],
            ['team', 'Team'],
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
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-subtitle font-semibold">Ranked constraints</h2>
              {ranked.length > 0 && (
                <DownloadChartButton
                  name="ranked-constraints"
                  build={(palette) => {
                    const top = Math.max(...ranked.map((row) => row.weightedScore), 1);
                    return barChartSvg(
                      {
                        title: 'Ranked constraints: weighted score',
                        note: `3 points for a first choice, 2 for second, 1 for third · ${chartNote}`,
                      },
                      ranked.map((row) => ({
                        label: row.label,
                        value: row.weightedScore / top,
                        text: `${row.weightedScore} (${row.firstChoices} first)`,
                      })),
                      palette,
                    );
                  }}
                />
              )}
            </div>
            <p className="mt-1 text-meta text-ink-soft">
              Weighted score gives 3 points to a first choice, 2 to a second and 1 to a third.
            </p>
            <table className="mt-3 w-full text-body">
              <thead>
                <tr className="border-b border-line text-left text-meta text-ink-soft">
                  <th scope="col" className="py-2">
                    Constraint
                  </th>
                  <th scope="col" className="py-2 text-right">
                    Score
                  </th>
                  <th scope="col" className="py-2 text-right">
                    1st
                  </th>
                  <th scope="col" className="py-2 text-right">
                    Named
                  </th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-normal">
                      {row.label}
                    </th>
                    <td className="py-2 text-right font-semibold">{row.weightedScore}</td>
                    <td className="py-2 text-right">{row.firstChoices}</td>
                    <td className="py-2 text-right">{row.count}</td>
                  </tr>
                ))}
                {ranked.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-3 text-ink-faint">
                      Nothing ranked yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className={card}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-subtitle font-semibold">Priority areas, mean rating</h2>
              {areas.some((area) => area.responses > 0) && (
                <DownloadChartButton
                  name="priority-areas"
                  build={(palette) =>
                    divergingChartSvg(
                      { title: 'Priority areas: how each was rated', note: chartNote },
                      areas
                        .filter((area) => area.responses > 0)
                        .map((area) => ({
                          label: area.label,
                          scores: area.scores,
                          text: `${area.mean.toFixed(1)} · ${percent(area.highPriorityShare)} 4–5`,
                        })),
                      priorityScale,
                      palette,
                    )
                  }
                />
              )}
            </div>
            <div className="mt-2">
              <ScaleLegend low={priorityScale[0]} high={priorityScale[1]} />
            </div>
            <ol className="mt-3 grid gap-3">
              {areas.map((area) => (
                <li key={area.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span>{area.label}</span>
                    <span className="shrink-0 text-meta text-ink-soft">
                      {area.mean.toFixed(2)} · {percent(area.highPriorityShare)} rated 4–5 · {area.responses} rated
                    </span>
                  </div>
                  <div className="mt-1">
                    <DivergingBar scores={area.scores} />
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className={card}>
              <h2 className="text-subtitle font-semibold">Constraints named</h2>
              {unprompted.interviews > 0 && (
                <p className="mt-1 text-meta text-ink-soft">
                  Beside each, how many of the {unprompted.interviews} interviewees raised it before the list was read —
                  the stronger signal.
                </p>
              )}
              <ul className="mt-3 grid gap-2 text-body">
                {mentioned.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3">
                    <span>{row.label}</span>
                    <span className="text-ink-soft">
                      {row.count} · {percent(row.share)}
                      {unprompted.interviews > 0 && (
                        <span className="ml-2 font-semibold text-ink">
                          {unprompted.counts.get(row.id) ?? 0} unprompted
                        </span>
                      )}
                    </span>
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
                    <span className="text-ink-soft">
                      {row.count} · {percent(row.share)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {funnel.started > 0 && (
            <section className={card}>
              <h2 className="text-subtitle font-semibold">Where people stop</h2>
              <p className="mt-1 text-meta text-ink-soft">
                {funnel.started} started, {funnel.completed} finished ({percent(funnel.completionRate)}). These counts
                come from a record of how far each session got — it holds no answers and nothing anybody typed.
              </p>
              <table className="mt-3 w-full text-body">
                <thead>
                  <tr className="border-b border-line text-left text-meta text-ink-soft">
                    <th scope="col" className="py-2">
                      Furthest step reached
                    </th>
                    <th scope="col" className="py-2 text-right">
                      Sessions
                    </th>
                    <th scope="col" className="py-2 text-right">
                      Stopped here
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {funnel.dropOff.map((step) => (
                    <tr key={step.stepId} className="border-b border-line last:border-0">
                      <th scope="row" className="py-2 pr-3 text-left font-normal">
                        {step.stepIndex + 1}. {step.stepId.replaceAll('_', ' ')}
                      </th>
                      <td className="py-2 text-right">{step.reached}</td>
                      <td className={`py-2 text-right font-semibold ${step.stopped > 0 ? 'text-danger' : ''}`}>
                        {step.stopped}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3 className="mt-5 text-meta font-semibold uppercase tracking-wide text-ink-faint">
                Finishing by branch
              </h3>
              <ul className="mt-2 grid gap-1 text-body">
                {funnel.byPathway.map((row) => (
                  <li key={row.pathway} className="flex justify-between gap-3">
                    <span>{row.pathway.replaceAll('_', ' ')}</span>
                    <span className="text-ink-soft">
                      {row.completed} of {row.started} · {percent(row.rate)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <section className={card}>
              <h2 className="text-subtitle font-semibold">Whose opinion counts</h2>
              <p className="mt-1 text-meta text-ink-soft">Where findings need to be heard to change anything.</p>
              <ul className="mt-3 grid gap-2 text-body">
                {trusted.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3">
                    <span>{row.label}</span>
                    <span className="text-ink-soft">
                      {row.count} · {percent(row.share)}
                    </span>
                  </li>
                ))}
                {trusted.length === 0 && <li className="text-ink-faint">No answers yet.</li>}
              </ul>
            </section>
            <section className={card}>
              <h2 className="text-subtitle font-semibold">Trying it small first</h2>
              <p className="mt-1 text-meta text-ink-soft">How much a small-scale trial matters before committing.</p>
              <ul className="mt-3 grid gap-2 text-body">
                {trial.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3">
                    <span>{row.label}</span>
                    <span className="text-ink-soft">{row.count}</span>
                  </li>
                ))}
                {trial.length === 0 && <li className="text-ink-faint">No answers yet.</li>}
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
                <h3 className="text-subtitle font-semibold">
                  {contact.name.trim().length > 0 ? contact.name : 'No name given'}
                </h3>
                <span className="text-meta text-ink-faint">{contact.submittedAt.slice(0, 10)}</span>
              </div>
              <p className="text-meta text-ink-soft">
                {[contact.organisation, contact.broadRole, contact.region]
                  .filter((part) => part.trim().length > 0)
                  .join(' · ')}
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

      {!data.loading && tab === 'change' && <ChangePanel responses={data.responses} />}

      {tab === 'phone' && <PhoneScriptPanel />}

      {tab === 'team' && <TeamPanel />}

      {tab === 'groups' && <GroupsPanel roundFilter={roundFilter} />}

      {!data.loading && tab === 'rounds' && <RoundEditor responses={data.responses} />}

      <section className="mt-8 flex flex-wrap gap-3 no-print" aria-label="Exports">
        <button
          type="button"
          className={primaryButton}
          onClick={() =>
            downloadCsv(
              `${currentProject().id.toLowerCase()}-responses-${stamp}.csv`,
              responsesCsv(questionnaire, filtered),
            )
          }
        >
          Export responses (CSV)
        </button>
        <button
          type="button"
          className={secondaryButton}
          onClick={() =>
            downloadCsv(
              `${currentProject().id.toLowerCase()}-contacts-${stamp}.csv`,
              contactsCsv(questionnaire, contacts),
            )
          }
        >
          Export contacts and EOI (CSV)
        </button>
        <button
          type="button"
          className={secondaryButton}
          onClick={() =>
            downloadCsv(
              `${currentProject().id.toLowerCase()}-comments-${stamp}.csv`,
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
