import type { ScoreboardSettings } from '../content/scoreboardSettings';
import {
  BLOCKS,
  STAGE_LABEL,
  THRESHOLD,
  TRACK,
  countText,
  featuredItems,
  isWebAddress,
  monthLabel,
  movedFrom,
  needsReason,
  timeline,
  type Edition,
  type Finding,
  type Participation,
  type PublicItem,
  type Stage,
} from '../services/scoreboard';

/**
 * One edition of the scoreboard, as the public sees it. The admin preview
 * draws the same component, so what the team approves is what goes out.
 *
 * Every graphic is drawn from the edition's own figures, sits beside the
 * same words in text, and has nothing under the threshold in it.
 */

const STAGE_STYLE: Readonly<Record<Stage, string>> = {
  listening: 'border border-line-strong bg-surface text-ink',
  scoped: 'border border-accent bg-selected text-ink',
  underway: 'border border-accent bg-accent text-ink',
  delivered: 'border border-primary bg-primary text-white',
  not_taken_forward: 'border border-ink-faint bg-surface text-ink',
  passed_on: 'border border-dashed border-ink-faint bg-surface text-ink',
};

export const StageChip = ({ stage }: { stage: Stage }) => (
  <span className={`inline-flex items-center rounded px-2 py-0.5 text-meta font-semibold whitespace-nowrap ${STAGE_STYLE[stage]}`}>
    {STAGE_LABEL[stage]}
  </span>
);

const ThemeTag = ({ theme }: { theme: string }) => (
  <span className="inline-flex rounded-full border border-accent bg-selected px-2 py-0.5 text-eyebrow font-semibold text-ink">
    {theme}
  </span>
);

const BlockTitle = ({ id, title, note }: { id: string; title: string; note?: string }) => (
  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b-2 border-line pb-1.5">
    <h2 id={id} className="text-subtitle font-extrabold">
      {title}
    </h2>
    {note !== undefined && <span className="text-meta text-ink-faint">{note}</span>}
  </div>
);

/**
 * Running total by week. Drawn only once there are two weeks to join. The
 * dates sit outside the drawing, so they stay readable on a phone however far
 * the chart is scaled; with many weeks only the latest point is marked, and
 * every week still answers on hover.
 */
const GrowthLine = ({ weekly }: { weekly: Participation['weekly'] }) => {
  if (weekly.length < 2) return null;
  const width = 470;
  const top = 8;
  const base = 66;
  const max = Math.max(...weekly.map((point) => point.cumulative));
  const x = (index: number): number => 6 + (index * (width - 12)) / (weekly.length - 1);
  const y = (value: number): number => base - (value / max) * (base - top);
  const points = weekly.map((point, index) => `${x(index).toFixed(1)} ${y(point.cumulative).toFixed(1)}`);
  const last = weekly[weekly.length - 1] as Participation['weekly'][number];
  const first = weekly[0] as Participation['weekly'][number];
  const few = weekly.length <= 12;
  const date = (iso: string): string =>
    new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00`));
  return (
    <figure className="m-0 grid gap-1">
      <svg
        viewBox={`0 0 ${width} ${base + 4}`}
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label={`Contributions to date by week, from ${first.cumulative} in the week to ${date(first.weekEnding)} to ${last.cumulative} by ${date(last.weekEnding)}.`}
      >
        <line x1="6" y1={base} x2={width - 6} y2={base} stroke="var(--color-line-strong)" strokeWidth="1" />
        <path d={`M${points.join(' L')} L${x(weekly.length - 1)} ${base} L6 ${base} Z`} fill="var(--color-selected)" />
        <path d={`M${points.join(' L')}`} fill="none" stroke="var(--color-primary-ink)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {weekly.map((point, index) => {
          const latest = index === weekly.length - 1;
          const shown = few || latest;
          return (
            <circle
              key={point.weekEnding}
              cx={x(index)}
              cy={y(point.cumulative)}
              r={latest ? 6 : shown ? 4 : 7}
              fill={shown ? 'var(--color-primary-ink)' : 'transparent'}
              stroke={latest ? 'var(--color-surface)' : 'none'}
              strokeWidth={latest ? 2 : 0}
            >
              <title>{`${date(point.weekEnding)}: ${point.cumulative}`}</title>
            </circle>
          );
        })}
      </svg>
      <figcaption className="flex justify-between text-eyebrow text-ink-faint">
        <span>{date(first.weekEnding)}</span>
        <span>{date(last.weekEnding)}</span>
      </figcaption>
    </figure>
  );
};

const MethodBars = ({ numbers }: { numbers: Participation }) => {
  const all: readonly (readonly [string, number | null])[] = [
    ['Online consultation', numbers.online],
    ['Workshops', numbers.workshops],
    ['Phone and in-person interviews', numbers.interviews],
  ];
  const rows = all.flatMap(([label, value]) => (value === null ? [] : [[label, value] as const]));
  if (rows.length === 0) return <p className="text-meta text-ink-faint">Each way has fewer than {THRESHOLD} so far.</p>;
  const max = Math.max(...rows.map(([, value]) => value));
  return (
    <ul className="grid gap-1.5" aria-label="How people took part">
      {rows.map(([label, value]) => (
        <li key={label} className="grid grid-cols-[minmax(0,7.5rem)_1fr_2.5rem] items-center gap-2 text-meta">
          <span>{label}</span>
          <span className="h-3 rounded-r bg-sunk" aria-hidden="true">
            <span className="block h-full rounded-r bg-primary-ink" style={{ width: `${(value / max) * 100}%` }} />
          </span>
          <span className="tabular text-right text-ink-soft">{value}</span>
        </li>
      ))}
    </ul>
  );
};

const RegionMap = ({ numbers, settings }: { numbers: Participation; settings: ScoreboardSettings }) => {
  const heard = numbers.regions.filter((region) => region.heardFrom).length;
  const nameOf = (id: string): string => settings.coverage.find((region) => region.id === id)?.name ?? id;
  const missing = numbers.regions.filter((region) => !region.heardFrom).map((region) => nameOf(region.id));
  return (
    <div className="grid gap-2">
      <p className="font-display text-display font-extrabold leading-none text-primary-ink tabular">
        {heard} <span className="font-sans text-body font-normal text-ink-soft">of {numbers.regions.length}</span>
      </p>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${settings.mapColumns}, minmax(0, 1fr))`, gridAutoRows: 'minmax(2.4rem, auto)' }}
        role="img"
        aria-label={`${heard} of ${numbers.regions.length} regions heard from.${missing.length > 0 ? ` Still needed: ${missing.join(', ')}.` : ''}`}
      >
        {settings.coverage.map((region) => {
          const on = numbers.regions.find((entry) => entry.id === region.id)?.heardFrom === true;
          return (
            <span
              key={region.id}
              className={`grid place-items-center rounded-md border-2 p-1 text-center text-eyebrow font-semibold leading-tight ${
                on ? 'border-primary-ink bg-primary-ink text-paper' : 'border-dashed border-primary-ink text-ink-faint'
              }`}
              style={{ gridColumn: `${region.col} / span ${region.span ?? 1}`, gridRow: region.row }}
            >
              {region.label}
            </span>
          );
        })}
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-eyebrow text-ink-faint">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm border-2 border-primary-ink bg-primary-ink" /> Heard from, {THRESHOLD} or more
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm border-2 border-dashed border-primary-ink" /> Still needed
        </span>
      </p>
    </div>
  );
};

const RegionDots = ({ finding }: { finding: Finding }) => {
  if (finding.regionsRaised === null || finding.regionsHeardFrom === null || finding.regionsHeardFrom === 0) return null;
  const all = finding.regionsRaised >= finding.regionsHeardFrom;
  return (
    <p className="flex flex-wrap items-center gap-2 text-meta text-ink-faint">
      <span className="inline-flex gap-1" aria-hidden="true">
        {Array.from({ length: finding.regionsHeardFrom }, (_, index) => (
          <span
            key={index}
            className={`inline-block size-2.5 rounded-full border-2 border-primary-ink ${index < (finding.regionsRaised ?? 0) ? 'bg-primary-ink' : ''}`}
          />
        ))}
      </span>
      {all
        ? `Raised in all ${finding.regionsHeardFrom} regions heard from`
        : `Raised in ${finding.regionsRaised} of the ${finding.regionsHeardFrom} regions heard from`}
    </p>
  );
};

const StageTrack = ({ item, period }: { item: PublicItem; period: string }) => {
  const at = TRACK.indexOf(item.stage);
  const before = movedFrom(item, period);
  return (
    <div>
      <ol className="relative grid grid-cols-4" aria-label={`Stage: ${STAGE_LABEL[item.stage]}, ${at + 1} of 4`}>
        <span className="absolute left-[12.5%] right-[12.5%] top-[6px] h-0.5 bg-line-strong" aria-hidden="true" />
        {TRACK.map((stage, index) => (
          <li key={stage} className={`relative grid justify-items-center gap-1 text-center text-eyebrow leading-tight ${index === at ? 'font-bold text-ink' : 'text-ink-faint'}`}>
            <span
              aria-hidden="true"
              className={`size-3.5 rounded-full border-2 ${
                index < at ? 'border-accent bg-accent' : index === at ? 'border-primary-ink bg-primary-ink ring-4 ring-selected' : 'border-line-strong bg-surface'
              }`}
            />
            {STAGE_LABEL[stage]}
          </li>
        ))}
      </ol>
      {before !== null && TRACK.indexOf(before) < at && (
        <p className="mt-1 text-eyebrow text-ink-soft">
          <span className="font-bold text-primary-ink">Moved up</span> from {STAGE_LABEL[before]} this month
        </p>
      )}
    </div>
  );
};

const CommitmentCard = ({ item, period }: { item: PublicItem; period: string }) => (
  <li className="grid gap-3 border-t border-line pt-3 first:border-0 first:pt-0 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,1.5fr)] md:gap-5">
    <div className="min-w-0">
      <h3 className="text-body font-semibold leading-snug">{item.title}</h3>
      <p className="mt-1.5 flex flex-wrap gap-1.5">
        {item.owner.length > 0 && (
          <span className="rounded-full border border-line-strong px-2 py-0.5 text-eyebrow font-semibold uppercase text-ink-soft">{item.owner}</span>
        )}
        {item.themes.map((theme) => (
          <ThemeTag key={theme} theme={theme} />
        ))}
      </p>
    </div>
    <StageTrack item={item} period={period} />
    <div className="min-w-0 text-meta">
      {item.progress.length > 0 && <p>{item.progress}</p>}
      {item.nextMilestone.length > 0 && (
        <p className="mt-1 text-ink-soft">
          Next: {item.nextMilestone}
          {item.milestoneMonth !== null && `, ${monthLabel(item.milestoneMonth)}`}
        </p>
      )}
      {item.planRef.length > 0 && <p className="mt-1 text-ink-faint">Delivers: {item.planRef}</p>}
    </div>
  </li>
);

const blockLabel = (id: string): string => BLOCKS.find((block) => block.id === id)?.label ?? id;

export interface ScoreboardViewProps {
  readonly edition: Edition;
  readonly numbers: Participation;
  readonly items: readonly PublicItem[];
  readonly settings: ScoreboardSettings;
  readonly projectName: string;
  readonly projectReference: string;
  /** The region this page is for, on a project with regional pages. */
  readonly scopeName?: string;
}

export const ScoreboardView = ({ edition, numbers, items, settings, projectName, projectReference, scopeName }: ScoreboardViewProps) => {
  const { content } = edition;
  const on = content.blocks;
  const featured = featuredItems(items);
  const upcoming = timeline(featured, edition.period).filter((month) => month.items.length > 0);
  const order: Readonly<Record<Stage, number>> = { underway: 0, scoped: 1, listening: 2, delivered: 3, passed_on: 4, not_taken_forward: 5 };
  const register = [...items].sort((a, b) => order[a.stage] - order[b.stage]);
  const title = edition.kind === 'annual' ? `${monthLabel(edition.period).split(' ')[1] ?? ''} annual playback` : `${monthLabel(edition.period)} update`;

  return (
    <article className="grid gap-8" aria-labelledby="scoreboard-motto">
      <header className="grid gap-2">
        <p className="font-display text-eyebrow font-extrabold uppercase tracking-wide text-primary-ink">
          {projectName} · {projectReference}
          {scopeName !== undefined && ` · ${scopeName}`}
        </p>
        <h1 id="scoreboard-motto">
          You said. We heard. <span className="text-primary-ink">We&rsquo;re acting.</span>
        </h1>
      </header>

      <section className="rounded-r-md border-l-[5px] border-accent bg-selected px-5 py-4" aria-label={title}>
        <p className="text-eyebrow font-bold uppercase tracking-wide text-ink-soft">{title}</p>
        <p className="mt-1 text-subtitle font-normal leading-snug">{content.statement}</p>
      </section>

      {on.participation && (
        <section className="grid gap-3" aria-labelledby="sb-part">
          <BlockTitle id="sb-part" title={blockLabel('participation')} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid content-start gap-2 rounded-lg border border-line p-4">
              <h3 className="text-eyebrow font-bold uppercase tracking-wide text-ink-soft">Contributions to date</h3>
              <p className="font-display text-display font-extrabold leading-none text-primary-ink tabular">{countText(numbers.total)}</p>
              <GrowthLine weekly={numbers.weekly} />
            </div>
            <div className="grid content-start gap-2 rounded-lg border border-line p-4">
              <h3 className="text-eyebrow font-bold uppercase tracking-wide text-ink-soft">How people took part</h3>
              <MethodBars numbers={numbers} />
              {numbers.groupPeople !== null && (
                <p className="text-meta text-ink-soft">Plus {numbers.groupPeople} people in group discussions.</p>
              )}
              {content.otherActivities.filter((activity) => activity.label.trim().length > 0).map((activity) => (
                <p key={activity.label} className="text-meta text-ink-soft">
                  {activity.label}: {activity.count}
                </p>
              ))}
              <p className="text-eyebrow text-ink-faint">Contributions, not people: answers are anonymous, so one person who took part twice counts twice.</p>
            </div>
            {numbers.regions.length > 0 && (
              <div className="grid content-start gap-2 rounded-lg border border-line p-4">
                <h3 className="text-eyebrow font-bold uppercase tracking-wide text-ink-soft">Regions heard from</h3>
                <RegionMap numbers={numbers} settings={settings} />
              </div>
            )}
          </div>
          {content.needYou.trim().length > 0 && (
            <p className="text-body">
              <strong className="text-primary-ink">Where we need you:</strong> {content.needYou}
            </p>
          )}
        </section>
      )}

      {on.heard && content.findings.length > 0 && (
        <section className="grid gap-3" aria-labelledby="sb-heard">
          <BlockTitle id="sb-heard" title={blockLabel('heard')} />
          <ul className="grid gap-3">
            {content.findings.map((finding) => (
              <li key={finding.id} className="grid overflow-hidden rounded-lg border border-line md:grid-cols-[1fr_1.3fr]">
                <div className="grid content-start gap-1.5 bg-sunk p-4">
                  <span className="text-eyebrow font-bold uppercase tracking-wide text-primary-ink">You said</span>
                  {finding.said.kind === 'quote' ? <q className="text-body">{finding.said.text}</q> : <p className="text-body">{finding.said.text}</p>}
                  <span className="text-eyebrow font-semibold uppercase text-ink-faint">
                    {finding.said.kind === 'quote' ? 'Quoted with permission' : 'Summary of what people told us'}
                  </span>
                </div>
                <div className="grid content-start gap-1.5 p-4">
                  <span className="text-eyebrow font-bold uppercase tracking-wide text-primary-ink">We heard</span>
                  <p className="text-body">{finding.heard}</p>
                  <RegionDots finding={finding} />
                  {finding.howWeKnow.trim().length > 0 && <p className="text-meta text-ink-faint">{finding.howWeKnow}</p>}
                  {finding.theme.length > 0 && (
                    <p>
                      <ThemeTag theme={finding.theme} />
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {on.check && content.check.by.trim().length > 0 && (
            <p className="text-meta text-ink-soft">
              Checked with {content.check.by} on {content.check.on} before publishing, so we know we heard you right.
            </p>
          )}
        </section>
      )}

      {on.acting && featured.length > 0 && (
        <section className="grid gap-4 rounded-xl border-2 border-primary-ink p-4 sm:p-5" aria-labelledby="sb-acting">
          <BlockTitle id="sb-acting" title={blockLabel('acting')} note="Each commitment shows the theme it answers" />
          <ul className="grid gap-4">
            {featured.map((item) => (
              <CommitmentCard key={item.id} item={item} period={edition.period} />
            ))}
          </ul>
          {on.timeline && upcoming.length > 0 && (
            <div className="grid gap-2">
              <h3 className="text-eyebrow font-bold uppercase tracking-wide text-ink-soft">Coming up</h3>
              <div className="overflow-x-auto">
                <ol className="grid min-w-[30rem] border-t-2 border-line-strong" style={{ gridTemplateColumns: `repeat(${upcoming.length}, minmax(7rem, 1fr))` }}>
                  {upcoming.map((month) => (
                    <li key={month.period} className="grid content-start gap-1.5 pt-2 pr-2">
                      <span className="text-eyebrow font-bold uppercase tracking-wide text-ink-soft">{monthLabel(month.period)}</span>
                      {month.items.map((item) => (
                        <span key={item.id} className="border-l-[3px] border-primary-ink pl-1.5 text-meta leading-snug">
                          {item.nextMilestone || item.title}
                        </span>
                      ))}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </section>
      )}

      {on.register && register.length > 0 && (
        <section className="grid gap-3" aria-labelledby="sb-register">
          <BlockTitle id="sb-register" title={blockLabel('register')} note="Every issue, and what happened to it" />
          <ul className="grid">
            {register.map((item) => (
              <li key={item.id} className="grid gap-1 border-b border-line py-2.5 last:border-0 sm:grid-cols-[minmax(0,1.4fr)_auto_minmax(0,1.2fr)] sm:items-center sm:gap-4">
                <span className="text-body font-semibold">{item.title}</span>
                <span>
                  <StageChip stage={item.stage} />
                </span>
                <span className="text-meta text-ink-soft">{needsReason(item.stage) ? item.reason : item.progress || item.nextMilestone}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(on.story || on.asked) && (
        <div className="grid gap-6 md:grid-cols-2">
          {on.story && content.story.text.trim().length > 0 && (
            <section className="grid content-start gap-2 border-l-[5px] border-accent pl-4" aria-labelledby="sb-story">
              <h2 id="sb-story" className="text-eyebrow font-bold uppercase tracking-wide text-ink-soft">
                {blockLabel('story')}
              </h2>
              <p className="font-display text-subtitle font-extrabold leading-snug">{content.story.text}</p>
              <p className="text-meta text-ink-faint">Why we chose it: {content.story.why} Shared with permission.</p>
            </section>
          )}
          {on.asked && content.asked.length > 0 && (
            <section className="grid content-start gap-2" aria-labelledby="sb-asked">
              <BlockTitle id="sb-asked" title={blockLabel('asked')} />
              <dl className="grid gap-1 text-body">
                {content.asked
                  .filter((pair) => pair.question.trim() && pair.answer.trim())
                  .map((pair) => (
                    <div key={pair.question} className="mt-1.5">
                      <dt className="font-semibold">{pair.question}</dt>
                      <dd className="text-ink-soft">{pair.answer}</dd>
                    </div>
                  ))}
              </dl>
            </section>
          )}
        </div>
      )}

      {on.playback && content.playback.howUsed.trim().length > 0 && (
        <section className="grid gap-3" aria-labelledby="sb-playback">
          <BlockTitle id="sb-playback" title="How your input was used" />
          <p className="text-body">{content.playback.howUsed}</p>
          {items.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-meta">
                <thead className="bg-sunk text-left text-eyebrow uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th scope="col" className="p-2.5">What was raised or committed</th>
                    <th scope="col" className="p-2.5">Theme</th>
                    <th scope="col" className="p-2.5">Plan item</th>
                    <th scope="col" className="p-2.5">What happened</th>
                  </tr>
                </thead>
                <tbody>
                  {register.map((item) => (
                    <tr key={item.id} className="border-t border-line align-top">
                      <th scope="row" className="p-2.5 text-left font-semibold">{item.title}</th>
                      <td className="p-2.5">{item.themes.join(', ')}</td>
                      <td className="p-2.5">{item.planRef}</td>
                      <td className="p-2.5">
                        <StageChip stage={item.stage} />
                        <span className="mt-1 block text-ink-soft">{needsReason(item.stage) ? item.reason : item.progress}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {isWebAddress(content.playback.usefulUrl) && (
            <p className="text-body">
              Is this page useful?{' '}
              <a href={content.playback.usefulUrl} className="font-semibold text-primary-ink underline underline-offset-4" target="_blank" rel="noreferrer">
                Tell us in one question
              </a>
            </p>
          )}
        </section>
      )}

      {/* Drawn only with an ordinary web address behind it, whatever reached the database. */}
      {on.next && content.next.headline.trim().length > 0 && isWebAddress(content.next.url) && (
        <section className="grid items-center gap-4 rounded-xl bg-primary p-5 text-white sm:grid-cols-[1fr_auto]" aria-labelledby="sb-next">
          <div>
            <p className="text-meta opacity-90">You can see we listened. What can you do now?</p>
            <h2 id="sb-next" className="font-display text-title font-extrabold leading-tight text-white">
              {content.next.headline}
            </h2>
          </div>
          <a
            href={content.next.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center justify-center justify-self-start rounded-lg bg-white px-5 py-3 font-semibold text-primary-ink"
          >
            {content.next.buttonLabel}
          </a>
        </section>
      )}

      <footer className="grid gap-2 border-t border-line pt-3 text-meta text-ink-faint">
        {edition.kind === 'monthly' && content.nextUpdate.length > 0 && <p>Next update: {content.nextUpdate}</p>}
        <details>
          <summary className="cursor-pointer font-semibold text-primary-ink">How we count</summary>
          <ul className="mt-2 grid list-disc gap-1 pl-5">
            <li>A contribution is one set of answers: online, by phone or in person, or at a workshop. Answers are anonymous, so they cannot be matched to people.</li>
            <li>Nothing here rests on fewer than {THRESHOLD} contributions. A smaller figure shows as "Fewer than {THRESHOLD}", and a region counts as heard from once it reaches {THRESHOLD}.</li>
            <li>Regions are shown as heard from or still needed, never ranked against each other.</li>
            <li>Quotes never carry a name, and are used only where the words cannot identify a person or a business. Everything else is a summary.</li>
            <li>Each update is fixed once published. A correction goes in the next one.</li>
          </ul>
        </details>
      </footer>
    </article>
  );
};
