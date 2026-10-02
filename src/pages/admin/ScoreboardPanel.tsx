import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { card, primaryButton, quietButton, secondaryButton, textInput } from '../../components/ui';
import { ScoreboardView, StageChip } from '../../components/ScoreboardView';
import { useQuestionnaire } from '../../contexts/QuestionnaireContext';
import { currentProject } from '../../content/projects';
import { scoreboardSettingsFor, type ScoreboardSettings } from '../../content/scoreboardSettings';
import { useStaffSession } from '../../hooks/useStaffSession';
import { loadGroups, type GroupRecord } from '../../services/groups';
import { linkFor } from '../../services/sources';
import { THEME_TAGS, type TagMap } from '../../services/tags';
import type { RoundConfig } from '../../services/rounds';
import {
  BLOCKS,
  MAX_SHOWN,
  MOTTO,
  STAGES,
  STAGE_LABEL,
  THRESHOLD,
  addMonths,
  countText,
  deleteDraft,
  deleteItem,
  featuredItems,
  freeze,
  inScope,
  countingResponses,
  itemsFor,
  loadEditions,
  loadItems,
  monthLabel,
  needsReason,
  newEdition,
  participation,
  periodOf,
  publishEdition,
  publishProblems,
  quoteCandidates,
  saveEdition,
  saveItem,
  themeEvidence,
  withStage,
  type BlockId,
  type Edition,
  type EditionContent,
  type EditionKind,
  type Finding,
  type ScoreboardItem,
  type Stage,
} from '../../services/scoreboard';
import type { ConsultationResponse } from '../../types';

/**
 * The scoreboard tab: draft a month, preview it exactly as the public will
 * see it, publish it, and hand the link to whoever runs the website.
 *
 * Four blocks make an edition. Everything borrowed from other programs is
 * here as a switch, off until somebody wants it.
 */

const publicAddress = (embed: boolean): string =>
  `${window.location.origin}${import.meta.env.BASE_URL}#/scoreboard${embed ? '?embed=1' : ''}`;

const CopyField = ({ id, label, value, help }: { id: string; label: string; value: string; help?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-meta font-semibold text-ink-soft">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        <input id={id} readOnly value={value} className={`${textInput} min-w-0 flex-1 font-mono text-meta`} onFocus={(event) => event.target.select()} />
        <button
          type="button"
          className={secondaryButton}
          onClick={() => {
            void navigator.clipboard
              .writeText(value)
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {help !== undefined && <p className="text-meta text-ink-faint">{help}</p>}
    </div>
  );
};

const Field = ({ id, label, help, children }: { id: string; label: string; help?: string; children: ReactNode }) => (
  <div className="grid gap-1.5">
    <label htmlFor={id} className="text-meta font-semibold text-ink">
      {label}
    </label>
    {children}
    {help !== undefined && <p className="text-meta text-ink-faint">{help}</p>}
  </div>
);

const emptyItem = (scope: string, by: string, now: Date): ScoreboardItem => ({
  id: crypto.randomUUID(),
  title: '',
  scope,
  stage: 'listening',
  owner: '',
  progress: '',
  nextMilestone: '',
  milestoneMonth: null,
  planRef: '',
  reason: '',
  themes: [],
  featured: false,
  history: [],
  updatedBy: by,
  updatedAt: now.toISOString(),
});

/** Adding to, or editing, the register of everything raised and committed. */
const ItemForm = ({
  item,
  settings,
  onSave,
  onCancel,
}: {
  item: ScoreboardItem;
  settings: ScoreboardSettings;
  onSave: (item: ScoreboardItem) => Promise<string | null>;
  onCancel: () => void;
}) => {
  const [draft, setDraft] = useState(item);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ScoreboardItem>): void => setDraft((current) => ({ ...current, ...patch }));
  const field = (name: string): string => `item-${item.id}-${name}`;
  return (
    <form
      className="grid gap-4 rounded-lg border border-line-strong bg-sunk p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSaving(true);
        void onSave(draft).then((problem) => {
          setSaving(false);
          setError(problem);
        });
      }}
    >
      <Field id={field('title')} label="What was raised, or what the project is committing to">
        <input id={field('title')} className={textInput} value={draft.title} maxLength={200} onChange={(event) => set({ title: event.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={field('stage')} label="Where it is">
          <select id={field('stage')} className={textInput} value={draft.stage} onChange={(event) => set({ stage: event.target.value as Stage })}>
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_LABEL[stage]}
              </option>
            ))}
          </select>
        </Field>
        <Field id={field('owner')} label="Who is responsible" help="Shown as a label on the commitment.">
          <input id={field('owner')} className={textInput} list={field('owners')} value={draft.owner} maxLength={60} onChange={(event) => set({ owner: event.target.value })} />
          <datalist id={field('owners')}>
            {settings.owners.map((owner) => (
              <option key={owner} value={owner} />
            ))}
          </datalist>
        </Field>
      </div>
      {needsReason(draft.stage) && (
        <Field
          id={field('reason')}
          label={draft.stage === 'passed_on' ? 'Who it was passed to' : 'Why it is not being taken forward'}
          help="Required. A no with a reason is still an answer, and it is what makes the rest believable."
        >
          <textarea id={field('reason')} className={textInput} rows={2} maxLength={600} value={draft.reason} onChange={(event) => set({ reason: event.target.value })} />
        </Field>
      )}
      <Field id={field('progress')} label="Latest progress">
        <textarea id={field('progress')} className={textInput} rows={2} maxLength={600} value={draft.progress} onChange={(event) => set({ progress: event.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={field('next')} label="Next milestone">
          <input id={field('next')} className={textInput} maxLength={200} value={draft.nextMilestone} onChange={(event) => set({ nextMilestone: event.target.value })} />
        </Field>
        <Field id={field('month')} label="Month of the next milestone" help="Places it on the Coming up timeline.">
          <input
            id={field('month')}
            type="month"
            className={textInput}
            value={draft.milestoneMonth ?? ''}
            onChange={(event) => set({ milestoneMonth: event.target.value === '' ? null : event.target.value })}
          />
        </Field>
      </div>
      <Field id={field('plan')} label="Plan item it delivers" help='Optional, such as "Milestone 102", so the page and the contract reporting tell the same story.'>
        <input id={field('plan')} className={textInput} maxLength={120} value={draft.planRef} onChange={(event) => set({ planRef: event.target.value })} />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="text-meta font-semibold">Themes it answers</legend>
        <div className="flex flex-wrap gap-2">
          {THEME_TAGS.map((theme) => {
            const on = draft.themes.includes(theme);
            return (
              <label key={theme} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-meta ${on ? 'border-primary bg-selected' : 'border-line-strong bg-surface'}`}>
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={on}
                  onChange={() => set({ themes: on ? draft.themes.filter((other) => other !== theme) : [...draft.themes, theme] })}
                />
                {theme}
              </label>
            );
          })}
        </div>
      </fieldset>
      {settings.regionalPages && (
        <Field id={field('scope')} label="Where it applies">
          <select id={field('scope')} className={textInput} value={draft.scope} onChange={(event) => set({ scope: event.target.value })}>
            <option value="national">Nationally</option>
            {settings.coverage.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {error !== null && (
        <p role="alert" className="text-meta font-semibold text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={primaryButton} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className={secondaryButton} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
};

/** The register: everything people raised, and everything the project has committed to. */
const Register = ({
  items,
  scope,
  settings,
  by,
  onChanged,
}: {
  items: readonly ScoreboardItem[];
  scope: string;
  settings: ScoreboardSettings;
  by: string;
  onChanged: () => void;
}) => {
  const [editing, setEditing] = useState<ScoreboardItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const shown = itemsFor(items, scope);
  const featuredCount = featuredItems(shown).length;

  const persist = async (item: ScoreboardItem): Promise<string | null> => {
    const now = new Date();
    const previous = items.find((other) => other.id === item.id);
    const staged = previous === undefined ? withStage({ ...item, stage: item.stage }, item.stage, now) : withStage({ ...item, stage: previous.stage, history: previous.history }, item.stage, now);
    const result = await saveItem({
      ...staged,
      featured: needsReason(item.stage) ? false : item.featured,
      updatedBy: by,
      updatedAt: now.toISOString(),
    });
    if (!result.success) return result.error;
    setEditing(null);
    onChanged();
    return null;
  };

  const toggleFeatured = async (item: ScoreboardItem): Promise<void> => {
    if (!item.featured && featuredCount >= MAX_SHOWN) {
      setMessage(`The page shows ${MAX_SHOWN} commitments at most. Untick one first.`);
      return;
    }
    setMessage(null);
    const result = await saveItem({ ...item, featured: !item.featured, updatedBy: by, updatedAt: new Date().toISOString() });
    if (!result.success) setMessage(result.error);
    onChanged();
  };

  return (
    <section className="grid gap-3" aria-labelledby="register-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="register-heading" className="text-subtitle font-semibold">
          The register
        </h3>
        <span className="text-meta text-ink-faint">
          {featuredCount} of {MAX_SHOWN} shown as this month&rsquo;s commitments
        </span>
      </div>
      <p className="text-meta text-ink-soft">
        Everything people raised and everything the project has committed to, with what happened to it. It carries from month
        to month. Tick up to {MAX_SHOWN} to lead the page; the rest appear under &ldquo;Everything you raised&rdquo; if that block is on.
      </p>
      {message !== null && (
        <p role="status" className="text-meta font-semibold text-danger">
          {message}
        </p>
      )}
      <ul className="grid gap-2">
        {shown.map((item) =>
          editing?.id === item.id ? (
            <li key={item.id}>
              <ItemForm item={editing} settings={settings} onSave={persist} onCancel={() => setEditing(null)} />
            </li>
          ) : (
            <li key={item.id} className="grid gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
              <label className="flex min-h-11 items-center gap-2 text-meta">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={item.featured && !needsReason(item.stage)}
                  disabled={needsReason(item.stage)}
                  onChange={() => void toggleFeatured(item)}
                />
                <span className="sr-only">Show {item.title} this month</span>
                <span aria-hidden="true">Show</span>
              </label>
              <div className="min-w-0">
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-meta text-ink-soft">
                  <StageChip stage={item.stage} />
                  {item.owner.length > 0 && <span>{item.owner}</span>}
                  {item.scope !== 'national' && <span>· {settings.coverage.find((region) => region.id === item.scope)?.name ?? item.scope}</span>}
                  <span className="text-ink-faint">· last edited by {item.updatedBy || 'unknown'}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className={quietButton} onClick={() => setEditing(item)}>
                  Edit
                </button>
                {confirmDelete === item.id ? (
                  <span className="flex items-center gap-2 text-meta">
                    Remove for good?
                    <button
                      type="button"
                      className={quietButton}
                      onClick={() => {
                        void deleteItem(item.id).then(() => {
                          setConfirmDelete(null);
                          onChanged();
                        });
                      }}
                    >
                      Remove
                    </button>
                    <button type="button" className={quietButton} onClick={() => setConfirmDelete(null)}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <button type="button" className={quietButton} onClick={() => setConfirmDelete(item.id)}>
                    Remove
                  </button>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
      {editing !== null && !shown.some((item) => item.id === editing.id) ? (
        <ItemForm item={editing} settings={settings} onSave={persist} onCancel={() => setEditing(null)} />
      ) : (
        <p>
          <button type="button" className={secondaryButton} onClick={() => setEditing(emptyItem(scope, by, new Date()))}>
            Add to the register
          </button>
        </p>
      )}
    </section>
  );
};

/** One finding: what people said, what the project heard, and the evidence behind it. */
const FindingForm = ({
  finding,
  index,
  evidence,
  quotes,
  onChange,
  onRemove,
}: {
  finding: Finding;
  index: number;
  evidence: ReturnType<typeof themeEvidence>;
  quotes: ReturnType<typeof quoteCandidates>;
  onChange: (finding: Finding) => void;
  onRemove: () => void;
}) => {
  const field = (name: string): string => `finding-${finding.id}-${name}`;
  const behind = evidence.find((entry) => entry.theme === finding.theme);
  const offered = quotes.filter((quote) => finding.theme === '' || quote.themes.includes(finding.theme));
  const set = (patch: Partial<Finding>): void => onChange({ ...finding, ...patch });
  return (
    <fieldset className="grid gap-4 rounded-lg border border-line-strong p-4">
      <legend className="px-1 text-meta font-semibold">Finding {index + 1}</legend>
      <Field id={field('theme')} label="Theme" help="Ties the finding to the commitments that answer it.">
        <select
          id={field('theme')}
          className={textInput}
          value={finding.theme}
          onChange={(event) => {
            const theme = event.target.value;
            const found = evidence.find((entry) => entry.theme === theme);
            set({
              theme,
              regionsRaised: found?.regionsHeardFrom ? found.regionsRaised : finding.regionsRaised,
              regionsHeardFrom: found?.regionsHeardFrom ? found.regionsHeardFrom : finding.regionsHeardFrom,
            });
          }}
        >
          <option value="">No theme</option>
          {[...new Set([...evidence.map((entry) => entry.theme), ...THEME_TAGS])].map((theme) => (
            <option key={theme} value={theme}>
              {theme}
            </option>
          ))}
        </select>
      </Field>
      {behind !== undefined && (
        <p className="rounded-md bg-sunk p-3 text-meta text-ink-soft">
          Behind it: {behind.comments} tagged {behind.comments === 1 ? 'comment' : 'comments'}, raised in {behind.regionsRaised} of the{' '}
          {behind.regionsHeardFrom} regions heard from.
        </p>
      )}
      <fieldset className="grid gap-2">
        <legend className="text-meta font-semibold">You said</legend>
        <div className="flex flex-wrap gap-4 text-meta">
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" className="size-4 accent-primary" name={field('kind')} checked={finding.said.kind === 'summary'} onChange={() => set({ said: { kind: 'summary', text: '' } })} />
            A summary in our words
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="radio" className="size-4 accent-primary" name={field('kind')} checked={finding.said.kind === 'quote'} onChange={() => set({ said: { kind: 'quote', text: '' } })} />
            A quote, from somebody who said yes to it
          </label>
        </div>
        {finding.said.kind === 'summary' ? (
          <textarea
            id={field('said')}
            aria-label="What people said, in a summary"
            className={textInput}
            rows={2}
            maxLength={600}
            placeholder="Growers told us…"
            value={finding.said.text}
            onChange={(event) => set({ said: { kind: 'summary', text: event.target.value } })}
          />
        ) : offered.length === 0 ? (
          <p className="text-meta text-ink-faint">
            No comment {finding.theme === '' ? '' : `tagged ${finding.theme} `}is from somebody who said yes to being quoted. Use a summary instead.
          </p>
        ) : (
          <select
            id={field('quote')}
            aria-label="Choose a quote"
            className={textInput}
            value={finding.said.text}
            onChange={(event) => set({ said: { kind: 'quote', text: event.target.value } })}
          >
            <option value="">Choose a comment…</option>
            {offered.map((quote) => (
              <option key={`${quote.responseId}-${quote.questionId}`} value={quote.text}>
                {quote.text.length > 140 ? `${quote.text.slice(0, 139)}…` : quote.text}
              </option>
            ))}
          </select>
        )}
        {finding.said.kind === 'quote' && finding.said.text.length > 0 && (
          <blockquote className="m-0 rounded-md bg-sunk p-3 text-meta">
            <q>{finding.said.text}</q>
          </blockquote>
        )}
      </fieldset>
      <Field id={field('heard')} label="We heard" help="What the project takes from it: an interpretation, not a poll result.">
        <textarea id={field('heard')} className={textInput} rows={2} maxLength={600} value={finding.heard} onChange={(event) => set({ heard: event.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={field('raised')} label="Regions that raised it">
          <input
            id={field('raised')}
            type="number"
            min={0}
            className={textInput}
            value={finding.regionsRaised ?? ''}
            onChange={(event) => set({ regionsRaised: event.target.value === '' ? null : Number(event.target.value) })}
          />
        </Field>
        <Field id={field('heardfrom')} label="Of the regions heard from">
          <input
            id={field('heardfrom')}
            type="number"
            min={0}
            className={textInput}
            value={finding.regionsHeardFrom ?? ''}
            onChange={(event) => set({ regionsHeardFrom: event.target.value === '' ? null : Number(event.target.value) })}
          />
        </Field>
        <Field id={field('how')} label="How we know" help="Optional.">
          <input id={field('how')} className={textInput} maxLength={200} value={finding.howWeKnow} onChange={(event) => set({ howWeKnow: event.target.value })} />
        </Field>
      </div>
      <p>
        <button type="button" className={quietButton} onClick={onRemove}>
          Remove this finding
        </button>
      </p>
    </fieldset>
  );
};

const EditionEditor = ({
  edition,
  items,
  responses,
  tags,
  groups,
  rounds,
  settings,
  by,
  onItemsChanged,
  onDone,
}: {
  edition: Edition;
  items: readonly ScoreboardItem[];
  responses: readonly ConsultationResponse[];
  tags: TagMap;
  groups: readonly GroupRecord[];
  rounds: readonly RoundConfig[];
  settings: ScoreboardSettings;
  by: string;
  onItemsChanged: () => void;
  onDone: () => void;
}) => {
  const questionnaire = useQuestionnaire();
  const [content, setContent] = useState<EditionContent>(edition.content);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState(false);
  const set = (patch: Partial<EditionContent>): void => {
    setContent((current) => ({ ...current, ...patch }));
    setSaved(null);
  };
  const setBlock = (id: BlockId, on: boolean): void => set({ blocks: { ...content.blocks, [id]: on } });

  const counted = useMemo(
    () => inScope(countingResponses(responses, rounds), edition.scope, settings.coverage),
    [responses, rounds, edition.scope, settings.coverage],
  );
  const numbers = useMemo(
    () => participation({ responses, groups, rounds, coverage: settings.coverage, scope: edition.scope, period: edition.period, now: new Date() }),
    [responses, groups, rounds, settings.coverage, edition.scope, edition.period],
  );
  const evidence = useMemo(() => themeEvidence(counted, tags, settings.coverage), [counted, tags, settings.coverage]);
  const quotes = useMemo(
    () => (numbers.total === null ? [] : quoteCandidates(questionnaire, counted, tags)),
    [numbers.total, questionnaire, counted, tags],
  );
  const current: Edition = { ...edition, content };
  const problems = publishProblems(current, items, numbers);
  const scoped = itemsFor(items, edition.scope);

  const save = async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    const result = await saveEdition({ ...current, updatedBy: by, updatedAt: new Date().toISOString() });
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return false;
    }
    setSaved('Draft saved.');
    return true;
  };

  const publish = async (): Promise<void> => {
    if (!(await save())) return;
    setBusy(true);
    const result = await publishEdition(freeze(current, items, numbers, by, new Date()));
    setBusy(false);
    setConfirming(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onDone();
  };

  const findingsFull = content.findings.length >= MAX_SHOWN;
  const id = (name: string): string => `ed-${edition.id}-${name}`;

  return (
    <section className={`${card} grid gap-6`} aria-labelledby={id('title')}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={id('title')} className="text-subtitle font-semibold">
          {edition.kind === 'annual' ? `Annual playback, ${edition.period.slice(0, 4)}` : `${monthLabel(edition.period)} update`}
          {edition.scope !== 'national' && ` · ${settings.coverage.find((region) => region.id === edition.scope)?.name ?? edition.scope}`}
        </h2>
        <button type="button" className={quietButton} onClick={onDone}>
          Back to all editions
        </button>
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-subtitle font-semibold">What this edition shows</legend>
        <p className="text-meta text-ink-soft">The first four make the page. The rest are ideas from other programs, there when they help.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {BLOCKS.map((block) => (
            <label key={block.id} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-3 ${content.blocks[block.id] ? 'border-primary bg-selected' : 'border-line bg-surface'}`}>
              <input type="checkbox" className="mt-1 size-5 shrink-0 accent-primary" checked={content.blocks[block.id]} onChange={(event) => setBlock(block.id, event.target.checked)} />
              <span className="min-w-0">
                <span className="block font-semibold">
                  {block.label}
                  {!block.core && <span className="ml-2 text-eyebrow font-semibold uppercase text-ink-faint">Optional</span>}
                </span>
                <span className="block text-meta text-ink-soft">{block.description}</span>
                {block.from !== undefined && <span className="block text-eyebrow text-ink-faint">From: {block.from}</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field id={id('statement')} label="The update, in a sentence or two" help="It sits at the top, under the motto. Say what was heard and what is happening now.">
        <textarea id={id('statement')} className={textInput} rows={3} maxLength={800} value={content.statement} onChange={(event) => set({ statement: event.target.value })} />
      </Field>

      {content.blocks.participation && (
        <section className="grid gap-3" aria-labelledby={id('part')}>
          <h3 id={id('part')} className="text-subtitle font-semibold">
            Who has taken part
          </h3>
          <p className="text-meta text-ink-soft">
            Worked out from the responses, as at the end of {monthLabel(edition.period)} or today if sooner, and frozen when you
            publish. Test answers and pilot rounds are left out. Anything under {THRESHOLD} shows as &ldquo;Fewer than {THRESHOLD}&rdquo;.
          </p>
          <ul className="grid gap-1 text-meta sm:grid-cols-2">
            <li>Contributions: {countText(numbers.total)}</li>
            <li>Online: {countText(numbers.online)}</li>
            <li>Interviews: {countText(numbers.interviews)}</li>
            <li>Workshops: {countText(numbers.workshops)}</li>
            <li>People in group discussions: {countText(numbers.groupPeople)}</li>
            <li>
              Regions heard from: {numbers.regions.filter((region) => region.heardFrom).length} of {numbers.regions.length}
            </li>
          </ul>
          <Field id={id('need')} label="Where we need you" help="The gap you are working to fill, such as a region or a kind of grower. Optional.">
            <textarea id={id('need')} className={textInput} rows={2} maxLength={400} value={content.needYou} onChange={(event) => set({ needYou: event.target.value })} />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="text-meta font-semibold">Activities held outside the tool</legend>
            <p className="text-meta text-ink-faint">Such as field visits or a webinar poll. Optional.</p>
            {content.otherActivities.map((activity, index) => (
              <div key={index} className="flex flex-wrap gap-2">
                <input
                  aria-label={`Activity ${index + 1}`}
                  className={`${textInput} min-w-0 flex-1`}
                  maxLength={80}
                  value={activity.label}
                  onChange={(event) => set({ otherActivities: content.otherActivities.map((other, at) => (at === index ? { ...other, label: event.target.value } : other)) })}
                />
                <input
                  aria-label={`How many, activity ${index + 1}`}
                  type="number"
                  min={0}
                  className={`${textInput} w-28`}
                  value={activity.count}
                  onChange={(event) => set({ otherActivities: content.otherActivities.map((other, at) => (at === index ? { ...other, count: Math.max(0, Number(event.target.value) || 0) } : other)) })}
                />
                <button type="button" className={quietButton} onClick={() => set({ otherActivities: content.otherActivities.filter((_, at) => at !== index) })}>
                  Remove
                </button>
              </div>
            ))}
            <p>
              <button type="button" className={quietButton} onClick={() => set({ otherActivities: [...content.otherActivities, { label: '', count: 0 }] })}>
                Add an activity
              </button>
            </p>
          </fieldset>
        </section>
      )}

      {content.blocks.heard && (
        <section className="grid gap-3" aria-labelledby={id('heard')}>
          <h3 id={id('heard')} className="text-subtitle font-semibold">
            What we heard
          </h3>
          {numbers.total === null ? (
            <p className="text-meta font-semibold text-danger">
              Findings need at least {THRESHOLD} contributions. Switch this block off until there are.
            </p>
          ) : (
            <p className="text-meta text-ink-soft">
              Up to {MAX_SHOWN}. The strongest themes in the tagged comments are offered first; tag comments on the Comments tab to
              give each one its evidence.
            </p>
          )}
          {content.findings.map((finding, index) => (
            <FindingForm
              key={finding.id}
              finding={finding}
              index={index}
              evidence={evidence}
              quotes={quotes}
              onChange={(next) => set({ findings: content.findings.map((other) => (other.id === finding.id ? next : other)) })}
              onRemove={() => set({ findings: content.findings.filter((other) => other.id !== finding.id) })}
            />
          ))}
          {!findingsFull && (
            <p>
              <button
                type="button"
                className={secondaryButton}
                onClick={() => {
                  const strongest = evidence.find((entry) => !content.findings.some((other) => other.theme === entry.theme));
                  set({
                    findings: [
                      ...content.findings,
                      {
                        id: crypto.randomUUID(),
                        theme: strongest?.theme ?? '',
                        said: { kind: 'summary', text: '' },
                        heard: '',
                        howWeKnow: '',
                        regionsRaised: strongest?.regionsHeardFrom ? strongest.regionsRaised : null,
                        regionsHeardFrom: strongest?.regionsHeardFrom ? strongest.regionsHeardFrom : null,
                      },
                    ],
                  });
                }}
              >
                Add a finding
              </button>
            </p>
          )}
        </section>
      )}

      <Register items={items} scope={edition.scope} settings={settings} by={by} onChanged={onItemsChanged} />

      {content.blocks.next && (
        <section className="grid gap-3" aria-labelledby={id('next')}>
          <h3 id={id('next')} className="text-subtitle font-semibold">
            Your next opportunity
          </h3>
          <Field id={id('next-headline')} label="The one thing to do next" help='Such as "Join a regional discussion session in November".'>
            <input id={id('next-headline')} className={textInput} maxLength={160} value={content.next.headline} onChange={(event) => set({ next: { ...content.next, headline: event.target.value } })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={id('next-button')} label="Button label">
              <input id={id('next-button')} className={textInput} maxLength={40} value={content.next.buttonLabel} onChange={(event) => set({ next: { ...content.next, buttonLabel: event.target.value } })} />
            </Field>
            <Field id={id('next-url')} label="Where the button goes" help="A full web address starting https://.">
              <input id={id('next-url')} type="url" className={textInput} maxLength={400} value={content.next.url} onChange={(event) => set({ next: { ...content.next, url: event.target.value } })} />
            </Field>
          </div>
          <p>
            <button
              type="button"
              className={quietButton}
              onClick={() =>
                set({
                  next: {
                    headline: content.next.headline || `Have your say in the ${currentProject().name} consultation`,
                    buttonLabel: content.next.buttonLabel || 'Take part',
                    url: linkFor(window.location.origin, 'scoreboard', import.meta.env.BASE_URL),
                  },
                })
              }
            >
              Point it at the consultation, labelled so the dashboard counts who came from the scoreboard
            </button>
          </p>
        </section>
      )}

      {edition.kind === 'monthly' && (
        <Field id={id('nextupdate')} label="Next update" help="Shown at the foot of the page.">
          <input id={id('nextupdate')} className={textInput} maxLength={60} value={content.nextUpdate} onChange={(event) => set({ nextUpdate: event.target.value })} />
        </Field>
      )}

      {content.blocks.story && (
        <section className="grid gap-3" aria-labelledby={id('story')}>
          <h3 id={id('story')} className="text-subtitle font-semibold">
            Story of the month
          </h3>
          <Field id={id('story-text')} label="The story" help="One change somebody made, in two or three sentences.">
            <textarea id={id('story-text')} className={textInput} rows={3} maxLength={800} value={content.story.text} onChange={(event) => set({ story: { ...content.story, text: event.target.value } })} />
          </Field>
          <Field id={id('story-why')} label="Why it was chosen">
            <input id={id('story-why')} className={textInput} maxLength={300} value={content.story.why} onChange={(event) => set({ story: { ...content.story, why: event.target.value } })} />
          </Field>
          <label className="flex min-h-11 items-center gap-3 text-body">
            <input type="checkbox" className="size-5 accent-primary" checked={content.story.consent} onChange={(event) => set({ story: { ...content.story, consent: event.target.checked } })} />
            The person agreed to this story being used
          </label>
        </section>
      )}

      {content.blocks.asked && (
        <section className="grid gap-3" aria-labelledby={id('asked')}>
          <h3 id={id('asked')} className="text-subtitle font-semibold">
            You asked
          </h3>
          {content.asked.map((pair, index) => (
            <div key={index} className="grid gap-2 rounded-lg border border-line p-3">
              <input aria-label={`Question ${index + 1}`} className={textInput} maxLength={200} placeholder="The question" value={pair.question} onChange={(event) => set({ asked: content.asked.map((other, at) => (at === index ? { ...other, question: event.target.value } : other)) })} />
              <textarea aria-label={`Answer ${index + 1}`} className={textInput} rows={2} maxLength={600} placeholder="The answer" value={pair.answer} onChange={(event) => set({ asked: content.asked.map((other, at) => (at === index ? { ...other, answer: event.target.value } : other)) })} />
              <p>
                <button type="button" className={quietButton} onClick={() => set({ asked: content.asked.filter((_, at) => at !== index) })}>
                  Remove
                </button>
              </p>
            </div>
          ))}
          <p>
            <button type="button" className={quietButton} onClick={() => set({ asked: [...content.asked, { question: '', answer: '' }] })}>
              Add a question
            </button>
          </p>
        </section>
      )}

      {content.blocks.check && (
        <section className="grid gap-3" aria-labelledby={id('check')}>
          <h3 id={id('check')} className="text-subtitle font-semibold">
            Did we hear you right?
          </h3>
          <p className="text-meta text-ink-soft">Before publishing, a regional rep or advisory group reads the findings. The page then says it was checked.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={id('check-by')} label="Checked with" help='Such as "the Tasmanian Regional Advisory Group".'>
              <input id={id('check-by')} className={textInput} maxLength={120} value={content.check.by} onChange={(event) => set({ check: { ...content.check, by: event.target.value } })} />
            </Field>
            <Field id={id('check-on')} label="On">
              <input id={id('check-on')} type="date" className={textInput} value={content.check.on} onChange={(event) => set({ check: { ...content.check, on: event.target.value } })} />
            </Field>
          </div>
        </section>
      )}

      {content.blocks.playback && (
        <section className="grid gap-3" aria-labelledby={id('playback')}>
          <h3 id={id('playback')} className="text-subtitle font-semibold">
            Annual playback
          </h3>
          <Field id={id('playback-how')} label="How input was used this year" help="The page lists every item on the register beneath it, with its theme, plan item and outcome.">
            <textarea id={id('playback-how')} className={textInput} rows={4} maxLength={1500} value={content.playback.howUsed} onChange={(event) => set({ playback: { ...content.playback, howUsed: event.target.value } })} />
          </Field>
          <Field id={id('playback-url')} label='Where "Is this page useful?" goes' help="Optional. A web address for one question about the scoreboard itself.">
            <input id={id('playback-url')} type="url" className={textInput} maxLength={400} value={content.playback.usefulUrl} onChange={(event) => set({ playback: { ...content.playback, usefulUrl: event.target.value } })} />
          </Field>
        </section>
      )}

      <section className="grid gap-3 border-t border-line pt-5" aria-labelledby={id('publish')}>
        <h3 id={id('publish')} className="text-subtitle font-semibold">
          Preview and publish
        </h3>
        {problems.length > 0 ? (
          <div role="status" className="rounded-lg border border-line-strong bg-sunk p-4">
            <p className="font-semibold">Before this can be published</p>
            <ul className="mt-2 grid list-disc gap-1 pl-5 text-meta">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-meta text-ink-soft">Ready to publish. Check the preview first: it is exactly what the public will see.</p>
        )}
        {error !== null && (
          <p role="alert" className="text-meta font-semibold text-danger">
            {error}
          </p>
        )}
        {saved !== null && (
          <p role="status" className="text-meta text-ink-soft">
            {saved}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" className={secondaryButton} disabled={busy} onClick={() => void save()}>
            Save draft
          </button>
          <button type="button" className={secondaryButton} onClick={() => setPreview((value) => !value)} aria-expanded={preview}>
            {preview ? 'Hide preview' : 'Preview'}
          </button>
          {!confirming ? (
            <button type="button" className={primaryButton} disabled={busy || problems.length > 0} onClick={() => setConfirming(true)}>
              Publish
            </button>
          ) : (
            <span className="flex flex-wrap items-center gap-3 rounded-lg border border-primary bg-selected p-3" role="group" aria-label="Confirm publishing">
              <span className="text-meta">Publishing fixes this edition for good. The numbers are frozen as they are now.</span>
              <button type="button" className={primaryButton} disabled={busy} onClick={() => void publish()}>
                {busy ? 'Publishing…' : 'Publish now'}
              </button>
              <button type="button" className={secondaryButton} onClick={() => setConfirming(false)}>
                Not yet
              </button>
            </span>
          )}
        </div>
        {preview && (
          <div className="rounded-xl border-2 border-dashed border-line-strong bg-paper p-4 sm:p-6">
            <ScoreboardView
              edition={current}
              numbers={numbers}
              items={scoped}
              settings={settings}
              projectName={currentProject().name}
              projectReference={currentProject().reference}
              scopeName={edition.scope === 'national' ? undefined : settings.coverage.find((region) => region.id === edition.scope)?.name}
            />
          </div>
        )}
      </section>
    </section>
  );
};

export const ScoreboardPanel = ({
  responses,
  tags,
  rounds,
}: {
  responses: readonly ConsultationResponse[];
  tags: TagMap;
  rounds: readonly RoundConfig[];
}) => {
  const settings = scoreboardSettingsFor(currentProject());
  const session = useStaffSession();
  const by = session.email ?? '';
  const [editions, setEditions] = useState<readonly Edition[]>([]);
  const [items, setItems] = useState<readonly ScoreboardItem[]>([]);
  const [groups, setGroups] = useState<readonly GroupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [startPeriod, setStartPeriod] = useState(periodOf(new Date()));
  const [startKind, setStartKind] = useState<EditionKind>('monthly');
  const [startScope, setStartScope] = useState('national');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [editionResult, itemResult, loadedGroups] = await Promise.all([loadEditions(), loadItems(), loadGroups()]);
    setGroups(loadedGroups);
    if (!editionResult.success) setError(editionResult.error);
    else if (!itemResult.success) setError(itemResult.error);
    else {
      setError(null);
      setEditions(editionResult.data);
      setItems(itemResult.data);
    }
    setLoading(false);
  }, []);

  const reloadItems = useCallback(async () => {
    const result = await loadItems();
    if (result.success) setItems(result.data);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const start = async (): Promise<void> => {
    setError(null);
    const previous = editions.find((edition) => edition.scope === startScope && edition.kind === 'monthly') ?? null;
    const edition = newEdition({ id: crypto.randomUUID(), period: startPeriod, scope: startScope, kind: startKind, previous, by, now: new Date() });
    const result = await saveEdition(edition);
    if (!result.success) {
      setError(result.error);
      return;
    }
    await reload();
    setOpenId(edition.id);
  };

  const open = editions.find((edition) => edition.id === openId) ?? null;
  const months = [-2, -1, 0, 1].map((step) => addMonths(periodOf(new Date()), step));
  const scopeName = (scope: string): string =>
    scope === 'national' ? 'National' : (settings.coverage.find((region) => region.id === scope)?.name ?? scope);

  if (loading) return <p className="mt-6 text-ink-soft">Loading the scoreboard…</p>;

  if (open !== null && open.status === 'draft') {
    return (
      <div className="mt-6">
        <EditionEditor
          key={open.id}
          edition={open}
          items={items}
          responses={responses}
          tags={tags}
          groups={groups}
          rounds={rounds}
          settings={settings}
          by={by}
          onItemsChanged={() => void reloadItems()}
          onDone={() => {
            setOpenId(null);
            void reload();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-6">
      <section className={`${card} grid gap-4`} aria-labelledby="scoreboard-heading">
        <div>
          <h2 id="scoreboard-heading" className="text-subtitle font-semibold">
            Monthly scoreboard
          </h2>
          <p className="mt-1 font-display text-title font-extrabold leading-tight">
            You said. We heard. <span className="text-primary-ink">We&rsquo;re acting.</span>
          </p>
          <p className="mt-2 text-meta text-ink-soft">
            A public page that shows what people told the consultation, what the project took from it and what it is doing about
            it. Draft a month here, preview it, publish it, and send the link to whoever manages the website. A published month is
            fixed, so its numbers never change underneath a reader.
          </p>
        </div>
        <CopyField id="scoreboard-link" label="Link to the public page" value={publicAddress(false)} help="Always shows the latest published update, with earlier months listed underneath." />
        <CopyField
          id="scoreboard-embed"
          label="To place it inside another website"
          value={`<iframe src="${publicAddress(true)}" title="${MOTTO} ${currentProject().name}" style="width:100%;height:2400px;border:0" loading="lazy"></iframe>`}
          help="The same page without this site's header and footer, for the website's manager to paste in. A plain link works just as well."
        />
        <p>
          <Link to="/scoreboard" className={quietButton} target="_blank" rel="noreferrer">
            Open the public page
          </Link>
        </p>
      </section>

      <section className={`${card} grid gap-4`} aria-labelledby="start-heading">
        <h2 id="start-heading" className="text-subtitle font-semibold">
          Start an edition
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="start-period" label="Month it reports on">
            <select id="start-period" className={textInput} value={startPeriod} onChange={(event) => setStartPeriod(event.target.value)}>
              {months.map((month) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="start-kind" label="Kind">
            <select id="start-kind" className={textInput} value={startKind} onChange={(event) => setStartKind(event.target.value as EditionKind)}>
              <option value="monthly">Monthly update</option>
              <option value="annual">Annual playback</option>
            </select>
          </Field>
          {settings.regionalPages && (
            <Field id="start-scope" label="For">
              <select id="start-scope" className={textInput} value={startScope} onChange={(event) => setStartScope(event.target.value)}>
                <option value="national">National</option>
                {settings.coverage.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <p className="text-meta text-ink-faint">The switches, the next opportunity and the answers to common questions carry over from the last edition.</p>
        <p>
          <button type="button" className={primaryButton} onClick={() => void start()}>
            Start the draft
          </button>
        </p>
        {error !== null && (
          <p role="alert" className="text-meta font-semibold text-danger">
            {error}
          </p>
        )}
      </section>

      <section className={card} aria-labelledby="editions-heading">
        <h2 id="editions-heading" className="text-subtitle font-semibold">
          Editions
        </h2>
        {editions.length === 0 ? (
          <p className="mt-2 text-ink-soft">None yet. Start the first one above.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {editions.map((edition) => (
              <li key={edition.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3">
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {edition.kind === 'annual' ? `Annual playback ${edition.period.slice(0, 4)}` : monthLabel(edition.period)}
                    {settings.regionalPages && ` · ${scopeName(edition.scope)}`}
                  </span>
                  <span className="block text-meta text-ink-soft">
                    {edition.status === 'published'
                      ? `Published ${edition.publishedAt === null ? '' : new Date(edition.publishedAt).toLocaleDateString('en-AU')} by ${edition.publishedBy ?? 'unknown'}`
                      : `Draft · last edited by ${edition.updatedBy || 'unknown'}`}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-3">
                  {edition.status === 'draft' ? (
                    <>
                      <button type="button" className={secondaryButton} onClick={() => setOpenId(edition.id)}>
                        Continue the draft
                      </button>
                      {confirmDelete === edition.id ? (
                        <span className="flex items-center gap-2 text-meta">
                          Delete this draft?
                          <button
                            type="button"
                            className={quietButton}
                            onClick={() => {
                              void deleteDraft(edition).then(() => {
                                setConfirmDelete(null);
                                void reload();
                              });
                            }}
                          >
                            Delete
                          </button>
                          <button type="button" className={quietButton} onClick={() => setConfirmDelete(null)}>
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button type="button" className={quietButton} onClick={() => setConfirmDelete(edition.id)}>
                          Delete
                        </button>
                      )}
                    </>
                  ) : (
                    <Link
                      className={quietButton}
                      target="_blank"
                      rel="noreferrer"
                      to={`/scoreboard/${edition.period}${edition.kind === 'annual' ? '/annual' : edition.scope === 'national' ? '' : `/${edition.scope}`}`}
                    >
                      View
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card} aria-label="The register">
        <Register items={items} scope="national" settings={settings} by={by} onChanged={() => void reloadItems()} />
      </section>
    </div>
  );
};
