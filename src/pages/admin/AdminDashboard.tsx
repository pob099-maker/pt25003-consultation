import { useEffect, useMemo, useRef, useState } from 'react';
import { currentProject } from '../../content/projects';
import { ProjectSwitcher } from './ProjectSwitcher';
import { isDemoSite, telHref } from '../../lib/config';
import { DivergingBar, ScaleLegend } from '../../components/DivergingBar';
import { DownloadChartButton } from '../../components/DownloadChartButton';
import { barChartSvg, divergingChartSvg } from '../../lib/chartImage';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { accentPanel, card, primaryButton, secondaryButton, textInput } from '../../components/ui';
import { useQuestionnaire } from '../../contexts/QuestionnaireContext';
import { useReportingFrame } from './useReportingFrame';
import { interestLabel, onScale, questionById, roleLabel } from '../../content/lookup';
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
import { CALLBACK_INTEREST_ID, CALLBACK_INTEREST_LABEL, isCallbackRequest } from '../../services/callback';
import { SOURCES, linkFor, tallyRoutes } from '../../services/sources';
import { THEME_TAGS, saveTags, tagKey } from '../../services/tags';
import { summariseProgress } from '../../services/progress';
import { useAdminData } from './useAdminData';
import { RoundEditor } from './RoundEditor';
import { PhoneScriptPanel } from './PhoneScriptPanel';
import { ChangePanel } from './ChangePanel';
import { TeamPanel } from './TeamPanel';
import { GroupsPanel } from './GroupsPanel';
import { ScoreboardPanel } from './ScoreboardPanel';
import { DemoWelcome } from '../../components/DemoWelcome';

const percent = (share: number): string => `${Math.round(share * 100)}%`;

const TABS = ['priorities', 'change', 'groups', 'comments', 'contacts', 'scoreboard', 'phone', 'rounds', 'team'] as const;
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
  // Every question and row any round asked, so stopping one never hides its history.
  const frame = useReportingFrame(data.responses, data.rounds);
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
  // The address says which tab is open, so a link can open one, e.g. back from
  // recording a group, or the demonstration tour's "Change over time". The tab
  // used to be read from it once, when the screen opened, so a link to another
  // tab from this same screen changed the address and nothing else.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab: Tab = isTab(requestedTab) ? requestedTab : 'priorities';
  const setTab = (id: Tab): void =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('tab', id);
        return next;
      },
      { replace: true },
    );
  // Arriving from a link further up the page, the tabs can be out of sight:
  // bring them into view so the switch is seen, not just made.
  const tabsRef = useRef<HTMLElement>(null);
  const firstTab = useRef(true);
  useEffect(() => {
    if (firstTab.current) {
      firstTab.current = false;
      return;
    }
    const top = tabsRef.current?.getBoundingClientRect().top;
    if (top !== undefined && (top < 0 || top > window.innerHeight * 0.6)) {
      tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [tab]);

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

  const stats = useMemo(() => overview(frame, filtered), [frame, filtered]);
  const ranked = useMemo(() => rankConstraints(frame, filtered, 'q2_top_three'), [frame, filtered]);
  const mentioned = useMemo(() => tallyMulti(frame, filtered, 'q1_constraints'), [frame, filtered]);
  const unprompted = useMemo(() => unpromptedCounts(filtered, 'q1_constraints'), [filtered]);
  const areas = useMemo(() => rateAreas(frame, filtered, 'q5_areas'), [frame, filtered]);
  const priorityScale = useMemo((): [string, string] => {
    const question = questionById(frame, 'q5_areas');
    return question?.kind === 'rating'
      ? [onScale(question.scale)[0]?.label ?? 'Low', onScale(question.scale).at(-1)?.label ?? 'High']
      : ['Low', 'High'];
  }, [frame]);
  // What every downloaded chart says about where its numbers came from.
  const chartNote = `${filtered.length} responses · ${currentProject().reference} consultation · ${new Date().toLocaleDateString(
    'en-AU',
    { day: 'numeric', month: 'short', year: 'numeric' },
  )}`;
  const evidence = useMemo(() => tallyMulti(frame, filtered, 'q7_evidence'), [frame, filtered]);
  const trusted = useMemo(() => tallyMulti(frame, filtered, 'q_trust'), [frame, filtered]);
  const sectors = useMemo(() => tallyMulti(frame, filtered, 'sector'), [frame, filtered]);
  const comments = useMemo(() => freeTextEntries(frame, filtered), [frame, filtered]);

  const toggleTag = async (responseId: string, questionId: string, tag: string): Promise<void> => {
    const key = tagKey(responseId, questionId);
    const current = data.tags[key] ?? [];
    const next = current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag];
    data.setTags(await saveTags(responseId, questionId, next, data.tags));
  };

  /**
   * Somebody waiting for a call comes first, and comes through the round
   * filter. The rest of the list is people who volunteered for something
   * months out, and the filter is right for them; a call-back request goes
   * stale in days, so dropping it from view because a new consultation started
   * overnight would lose the one record the email says to work from.
   *
   * Partitioned rather than sorted, so the order is stated rather than resting
   * on Array.prototype.sort happening to be stable.
   */
  const waiting = useMemo(
    () => data.contacts.filter((contact) => isCallbackRequest(contact) && (includeTest || !contact.isTestData)),
    [data.contacts, includeTest],
  );
  const contactList = useMemo(
    () => [...waiting, ...contacts.filter((contact) => !isCallbackRequest(contact))],
    [waiting, contacts],
  );
  const waitingForCall = waiting.length;

  // What people volunteered for, counted. This is the list the project works
  // from when it comes to filling the reference group or finding a trial host.
  const interestTally = useMemo(() => {
    const counts = new Map<string, number>();
    for (const contact of contacts) {
      // A call back is a job to do, not something volunteered for. It is
      // counted above; leaving it here would put it among the trial hosts.
      for (const id of contact.interests) {
        if (id !== CALLBACK_INTEREST_ID) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ id, label: interestLabel(questionnaire, id), count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [contacts, questionnaire]);

  // How the answers arrived, for knowing where the next project should put
  // its effort. Follows every filter above, so it can be read per round.
  const routes = useMemo(() => tallyRoutes(filtered), [filtered]);

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
          {/* Nobody signed in to the demonstration, and this is the first
              screen its visitors see: offering to sign them out of nothing
              only makes them wonder what they are logged into. */}
          {!isDemoSite() && (
            <button type="button" className="text-meta text-primary-ink underline underline-offset-4" onClick={onSignOut}>
              Sign out
            </button>
          )}
        </span>
      </div>
      <p className="mt-2 text-body text-ink">
        Working in <strong>{currentProject().name}</strong>
        {currentProject().reference.length > 0 ? ` (${currentProject().reference})` : ''}.
      </p>
      <p className="mt-1 text-meta text-ink-soft">
        {questionnaire.roundLabel}. Everything on this screen belongs to this project. Contact details are listed
        separately and are not linked to any set of answers.
      </p>

      {/* The demonstration link lands here, so the tour is here rather than on
          the landing page. A developer with no backend gets the plain notice
          instead: they know what they are looking at. */}
      {isDemoSite() && <DemoWelcome here="/admin" />}
      {data.demoMode && !isDemoSite() && (
        <p className={`${accentPanel} mt-5 text-body`} role="status">
          No backend is configured, so this screen is showing generated <strong>demonstration data</strong>. Set the
          Supabase environment variables to see real responses.
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
        <Stat
          label="Finished the full version"
          value={percent(stats.completionRate)}
          note="Answered its last section. The short version is not counted."
        />
        <Stat label="Median time taken" value={`${stats.medianMinutes} min`} />
        <Stat label="Contact records" value={String(contacts.length)} note="Asked to be contacted" />
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

      <nav ref={tabsRef} className="mt-6 flex scroll-mt-4 flex-wrap gap-2" aria-label="Sections">
        {(
          [
            ['priorities', 'Priorities'],
            ['change', 'Change over time'],
            ['groups', 'Groups'],
            ['comments', `Comments (${comments.length})`],
            ['contacts', `Contacts (${contacts.length})`],
            ['scoreboard', 'Scoreboard'],
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

          {/* Always shown: the links to put out are here, and they are needed
              before the first answer arrives, which is when the card used to
              be hidden. */}
          <section className={card} aria-labelledby="routes">
            <h2 id="routes" className="text-subtitle font-semibold">
              How people came in
            </h2>
            <p className="mt-1 text-meta text-ink-soft">
              Which link each answer arrived by, so the next project knows where to put its effort. It records a
              channel, never a person: a link carrying anything other than the labels below is counted as one we do
              not recognise.
            </p>
            <ul className="mt-3 grid gap-3 text-body">
              {routes.length === 0 && <li className="text-ink-faint">No answers yet.</li>}
              {routes.map((row) => (
                <li key={row.key}>
                  <div className="flex justify-between gap-3">
                    <span>{row.label}</span>
                    <span className="text-ink-soft tabular-nums">
                      {row.count} · {percent(row.count / filtered.length)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-sunk" aria-hidden="true">
                    <div
                      className="h-2 rounded-full bg-accent"
                      style={{ width: `${Math.max(2, (row.count / filtered.length) * 100)}%` }}
                    />
                  </div>
                  {row.parts.length > 0 && (
                    <ul className="mt-1 grid gap-0.5 pl-3 text-meta text-ink-soft">
                      {row.parts.map((part) => (
                        <li key={part.label} className="flex justify-between gap-3">
                          <span>{part.label}</span>
                          <span className="tabular-nums">{part.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            <details className="mt-4" open={filtered.length === 0}>
              <summary className="cursor-pointer text-meta font-semibold text-primary-ink">Links to use</summary>
              <p className="mt-2 text-meta text-ink-soft">
                Put the matching link in the magazine, the newsletter or the email. Use one link per channel and never
                one per person; the site files anything it does not recognise as unrecognised, so a name can never
                end up attached to somebody's answers.
              </p>
              <ul className="mt-2 grid gap-2">
                {SOURCES.map((source) => (
                  <li key={source.id}>
                    <span className="block text-meta text-ink-soft">{source.label}</span>
                    <code className="block select-all break-all text-body text-ink">
                      {linkFor(window.location.origin, source.id, import.meta.env.BASE_URL)}
                    </code>
                  </li>
                ))}
              </ul>
            </details>
          </section>

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
              <h2 className="text-subtitle font-semibold">Part of the industry</h2>
              <p className="mt-1 text-meta text-ink-soft">Where the people answering work. Many work in more than one.</p>
              <ul className="mt-3 grid gap-2 text-body">
                {sectors.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3">
                    <span>{row.label}</span>
                    <span className="text-ink-soft">
                      {row.count} · {percent(row.share)}
                    </span>
                  </li>
                ))}
                {sectors.length === 0 && <li className="text-ink-faint">No answers yet.</li>}
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
          {waitingForCall > 0 && (
            <p className={`${accentPanel} text-body`}>
              {waitingForCall === 1
                ? 'One person has asked us to ring them, and is at the top of the list.'
                : `${waitingForCall} people have asked us to ring them, and are at the top of the list.`}{' '}
              Ring them inside a day or two if you can, and take their answers on the phone screen.
            </p>
          )}
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
          {contactList.map((contact) => (
            <article key={contact.id} className={card}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-subtitle font-semibold">
                  {contact.name.trim().length > 0 ? contact.name : 'No name given'}
                </h3>
                <span className="text-meta text-ink-faint">{contact.submittedAt.slice(0, 10)}</span>
              </div>
              {isCallbackRequest(contact) && (
                <p className="mt-1 inline-block rounded-md border border-primary bg-selected px-2 py-1 text-meta font-semibold text-ink">
                  {CALLBACK_INTEREST_LABEL}
                </p>
              )}
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
                {contact.phone.trim().length > 0 && (
                  <a className="underline underline-offset-4" href={telHref(contact.phone)}>
                    {contact.phone}
                  </a>
                )}
              </p>
              {/* The badge above already says a callback was asked for, so the
                  line is only worth printing when there is something else on it. */}
              {contact.interests.some((id) => id !== CALLBACK_INTEREST_ID) && (
                <p className="mt-2 text-meta text-ink-soft">
                  Interested in:{' '}
                  {contact.interests
                    .filter((id) => id !== CALLBACK_INTEREST_ID)
                    .map((id) => interestLabel(questionnaire, id))
                    .join(', ')}
                </p>
              )}
              {contact.preferredContactTime.trim().length > 0 && (
                <p className="mt-1 text-meta text-ink-soft">Best time: {contact.preferredContactTime}</p>
              )}
              {contact.comments.trim().length > 0 && <p className="mt-2 text-body">{contact.comments}</p>}
            </article>
          ))}
          {contacts.length === 0 && <p className="text-ink-soft">No contact records yet.</p>}
        </div>
      )}

      {!data.loading && tab === 'change' && <ChangePanel responses={data.responses} rounds={data.rounds} />}

      {!data.loading && tab === 'scoreboard' && (
        <ScoreboardPanel responses={data.responses} tags={data.tags} rounds={data.rounds} />
      )}

      {tab === 'phone' && <PhoneScriptPanel />}

      {tab === 'team' && <TeamPanel />}

      {tab === 'groups' && <GroupsPanel roundFilter={roundFilter} frame={frame} />}

      {!data.loading && tab === 'rounds' && <RoundEditor
          responses={data.responses}
          rounds={data.rounds}
          roundsError={data.roundsError}
          onSaved={data.reloadRounds}
        />}

      <section className="mt-8 flex flex-wrap gap-3 no-print" aria-label="Exports">
        <button
          type="button"
          className={primaryButton}
          onClick={() =>
            downloadCsv(
              `${currentProject().id.toLowerCase()}-responses-${stamp}.csv`,
              responsesCsv(frame, filtered),
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
