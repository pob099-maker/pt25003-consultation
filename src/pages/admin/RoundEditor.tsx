import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { currentProject, purposeTemplate } from '../../content/projects';
import { ReadinessPanel } from './ReadinessPanel';
import type { ConsultationResponse } from '../../types';
import { card, primaryButton, secondaryButton, textInput } from '../../components/ui';
import { allQuestions, allSections } from '../../content/lookup';
import { libraryIds, libraryQuestion } from '../../content/library';
import {
  loadActiveRound,
  loadAllRounds,
  saveRound,
  type QuestionOverride,
  type RoundConfig,
} from '../../services/rounds';
import type { RoundStage } from '../../types';
import { COLLECTION, ROLE_HELP, ROLE_LABEL, planSentence } from '../../content/vocabulary';

/** What a consultation is, structurally. The project gives it its own name. */
const ROLES: readonly RoundStage[] = ['pilot', 'baseline', 'review'];

const emptyRound = (): RoundConfig => ({
  roundId: currentProject().questionnaire.roundId,
  label: currentProject().questionnaire.roundLabel,
  stage: currentProject().questionnaire.stage,
  isActive: true,
  overrides: {},
});

/**
 * Questions from the shared library that this project's questionnaire does not
 * already ask. Only shown when there are any — for project one, the library
 * and the questionnaire are the same list.
 */
const LibraryAdditions = ({
  sectionId,
  overrides,
  onChange,
}: {
  sectionId: string;
  overrides: RoundConfig['overrides'];
  onChange: (questionId: string, addTo: string | undefined) => void;
}) => {
  const [choice, setChoice] = useState('');
  const asked = new Set(allQuestions(currentProject().questionnaire).map((question) => question.id));
  const available = libraryIds().filter((id) => !asked.has(id));
  if (available.length === 0) return null;
  const added = available.filter((id) => overrides[id]?.addTo === sectionId);
  const addable = available.filter((id) => overrides[id]?.addTo === undefined);
  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="text-meta font-semibold text-ink-soft">Added from the question library</p>
      <ul className="mt-2 grid gap-1">
        {added.map((id) => (
          <li key={id} className="flex items-center justify-between gap-3 text-body">
            <span>{libraryQuestion(id)?.prompt ?? id}</span>
            <button type="button" className={secondaryButton} onClick={() => onChange(id, undefined)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      {addable.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          <label htmlFor={`add-${sectionId}`} className="sr-only">
            Question to add
          </label>
          <select
            id={`add-${sectionId}`}
            className={`${textInput} max-w-md`}
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
          >
            <option value="">Choose a question…</option>
            {addable.map((id) => (
              <option key={id} value={id}>
                {libraryQuestion(id)?.prompt ?? id}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={secondaryButton}
            disabled={choice === ''}
            onClick={() => {
              onChange(choice, sectionId);
              setChoice('');
            }}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Lets project staff change the words without changing what a historic answer
 * means. Question ids and option ids are fixed and are not editable here:
 * every stored response points at them, so renaming an option relabels the
 * same thing, while a new id would be a new thing.
 */
export const RoundEditor = ({ responses = [] }: { responses?: readonly ConsultationResponse[] }) => {
  const [round, setRound] = useState<RoundConfig>(emptyRound);
  const [history, setHistory] = useState<readonly RoundConfig[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadActiveRound().then((loaded) => {
      if (loaded !== null) setRound(loaded);
    });
    void loadAllRounds().then(setHistory);
  }, []);

  const setOverride = (questionId: string, patch: Partial<QuestionOverride>): void =>
    setRound((current) => ({
      ...current,
      overrides: {
        ...current.overrides,
        [questionId]: { ...(current.overrides[questionId] ?? {}), ...patch },
      },
    }));

  const save = async (): Promise<void> => {
    setBusy(true);
    const error = await saveRound(round);
    setBusy(false);
    setStatus(error === null ? 'Saved. New responses will use this wording.' : error);
  };

  /** Presets, so nobody has to invent a name. Every one of them can be typed over. */
  const startNew = (stage: RoundStage, name: string): void => {
    const suffix = new Date().toISOString().slice(0, 10);
    setRound({
      roundId: `${suffix}-${stage}`,
      label: name,
      stage,
      isActive: true,
      overrides: round.overrides,
    });
    setStatus(
      `"${name}" is ready to start. Everything already collected keeps the ${COLLECTION.one} it was given in and is untouched. Save to begin.`,
    );
  };

  const purpose = purposeTemplate(currentProject().purpose);

  return (
    <div className="mt-6 grid gap-5">
      <ReadinessPanel responses={responses} />

      {/* The wording lives on this tab, so this is where somebody thinks to
          look for a copy of it to send to a colleague or a reference group. */}
      <p className="text-meta text-ink-soft">
        To read or send the whole questionnaire,{' '}
        <Link to="/questions" className="underline underline-offset-4">
          open the printable question paper
        </Link>
        . It marks which questions the short version asks, and saves as a PDF.
      </p>

      <section className={card}>
        <h2 className="text-subtitle font-semibold">This {COLLECTION.one}</h2>
        <p className="mt-1 text-body text-ink">
          {planSentence(
            currentProject().name,
            purpose.stages.includes('review'),
            round.label.trim().length > 0 ? round : null,
          )}
        </p>
        {history.length > 0 && (
          <ol className="mt-3 flex flex-wrap items-center gap-2 text-meta">
            {history.map((entry) => (
              <li
                key={entry.roundId}
                className={`rounded-full border px-3 py-1 ${
                  entry.roundId === round.roundId ? 'border-primary bg-selected text-ink' : 'border-line text-ink-soft'
                }`}
              >
                {entry.label} <span className="text-ink-faint">· {ROLE_LABEL[entry.stage].toLowerCase()}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-meta text-ink-soft">
          The people you ask never see any of this. They see a {COLLECTION.one}; the names below are for your own
          reporting.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="round-id" className="mb-1 block text-meta font-semibold text-ink-soft">
              Short code, used in exports
            </label>
            <input
              id="round-id"
              className={textInput}
              value={round.roundId}
              onChange={(event) => setRound({ ...round, roundId: event.target.value })}
            />
          </div>
          <div>
            <label htmlFor="round-label" className="mb-1 block text-meta font-semibold text-ink-soft">
              What you call it
            </label>
            <input
              id="round-label"
              className={textInput}
              value={round.label}
              onChange={(event) => setRound({ ...round, label: event.target.value })}
            />
          </div>
        </div>
        <fieldset className="mt-4">
          <legend className="mb-1 text-meta font-semibold text-ink-soft">What this one is</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {ROLES.map((role) => (
              <label
                key={role}
                className={`flex cursor-pointer gap-2 rounded-lg border p-3 ${
                  round.stage === role ? 'border-primary bg-selected' : 'border-line bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="round-stage"
                  className="mt-1 accent-primary"
                  checked={round.stage === role}
                  onChange={() => setRound({ ...round, stage: role })}
                />
                <span>
                  <span className="block font-semibold text-ink">{ROLE_LABEL[role]}</span>
                  <span className="block text-meta text-ink-soft">{ROLE_HELP[role]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className={primaryButton} onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          {purpose.stages.includes('baseline') && (
            <button type="button" className={secondaryButton} onClick={() => startNew('baseline', 'Baseline')}>
              Start the starting point
            </button>
          )}
          {purpose.stages.includes('review') && (
            <>
              <button type="button" className={secondaryButton} onClick={() => startNew('review', 'Mid-term review')}>
                Start a follow-up
              </button>
              <button type="button" className={secondaryButton} onClick={() => startNew('review', 'Final review')}>
                Start the final one
              </button>
            </>
          )}
        </div>
        <p className="mt-3 text-meta text-ink-soft">
          <strong className="text-ink">{purpose.label}:</strong> {purpose.what}
        </p>
        <p className="mt-2 text-meta text-ink-soft">
          The <strong>Phone script</strong> tab follows whatever is written below, so somebody taking a response over
          the phone asks exactly what the form asks. Look there again after you change any wording.
        </p>
        {status !== null && (
          <p className="mt-3 text-meta text-ink-soft" role="status">
            {status}
          </p>
        )}
      </section>

      {allSections(currentProject().questionnaire).map((section) => (
        <section key={section.id} className={card}>
          <h3 className="text-subtitle font-semibold">{section.title}</h3>
          <div className="mt-3 grid gap-5">
            {section.questions.map((question) => {
              const override = round.overrides[question.id] ?? {};
              const options =
                question.kind === 'multi' || question.kind === 'single'
                  ? question.options
                  : question.kind === 'rating'
                    ? question.rows
                    : question.kind === 'rank'
                      ? question.fallbackOptions
                      : [];
              return (
                <div key={question.id} className="border-t border-line pt-4 first:border-0 first:pt-0">
                  <p className="text-meta text-ink-faint">
                    {question.id}
                    {question.tracking === true && (
                      <span className="ml-2 rounded-full border border-accent px-2 py-0.5 text-eyebrow uppercase text-ink-soft">
                        Tracked · locked
                      </span>
                    )}
                  </p>
                  {question.tracking !== true && (
                    <label className="mt-1 flex items-center gap-2 text-meta text-ink-soft">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={override.retired === true}
                        onChange={(event) => setOverride(question.id, { retired: event.target.checked })}
                      />
                      Retire from this round — answers already given are kept
                    </label>
                  )}
                  {question.tracking === true && (
                    <p className="mt-1 text-meta text-ink-soft">
                      Asked word for word in every round so the baseline can be compared with each review. Changing it —
                      even adding an option — would break that comparison, so it cannot be edited here.
                    </p>
                  )}
                  <label
                    htmlFor={`${question.id}-prompt`}
                    className="mt-1 mb-1 block text-meta font-semibold text-ink-soft"
                  >
                    Question wording
                  </label>
                  <textarea
                    id={`${question.id}-prompt`}
                    className={textInput}
                    rows={2}
                    value={override.prompt ?? question.prompt}
                    disabled={question.tracking === true}
                    onChange={(event) => setOverride(question.id, { prompt: event.target.value })}
                  />
                  <label
                    htmlFor={`${question.id}-help`}
                    className="mt-2 mb-1 block text-meta font-semibold text-ink-soft"
                  >
                    Guidance below the question
                  </label>
                  <input
                    id={`${question.id}-help`}
                    className={textInput}
                    value={override.help ?? question.help ?? ''}
                    disabled={question.tracking === true}
                    onChange={(event) => setOverride(question.id, { help: event.target.value })}
                  />
                  {options.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-meta font-semibold text-primary-ink">
                        Answer options ({options.length})
                      </summary>
                      <ul className="mt-2 grid gap-2">
                        {options.map((option) => (
                          <li key={option.id}>
                            <label
                              htmlFor={`${question.id}-${option.id}`}
                              className="mb-1 block text-meta text-ink-faint"
                            >
                              {option.id}
                            </label>
                            <input
                              id={`${question.id}-${option.id}`}
                              className={textInput}
                              value={override.optionLabels?.[option.id] ?? option.label}
                              disabled={question.tracking === true}
                              onChange={(event) =>
                                setOverride(question.id, {
                                  optionLabels: { ...(override.optionLabels ?? {}), [option.id]: event.target.value },
                                })
                              }
                            />
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
          <LibraryAdditions
            sectionId={section.id}
            overrides={round.overrides}
            onChange={(questionId, addTo) => setOverride(questionId, { addTo })}
          />
        </section>
      ))}
    </div>
  );
};
