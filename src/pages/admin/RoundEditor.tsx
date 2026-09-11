import { useEffect, useState } from 'react';
import { card, primaryButton, secondaryButton, textInput } from '../../components/ui';
import { DEFAULT_QUESTIONNAIRE } from '../../content/questionnaire';
import { allSections } from '../../content/lookup';
import { loadActiveRound, saveRound, type QuestionOverride, type RoundConfig } from '../../services/rounds';

const emptyRound = (): RoundConfig => ({
  roundId: DEFAULT_QUESTIONNAIRE.roundId,
  label: DEFAULT_QUESTIONNAIRE.roundLabel,
  isActive: true,
  overrides: {},
});

/**
 * Lets project staff change the words without changing what a historic answer
 * means. Question ids and option ids are fixed and are not editable here:
 * every stored response points at them, so renaming an option relabels the
 * same thing, while a new id would be a new thing.
 */
export const RoundEditor = () => {
  const [round, setRound] = useState<RoundConfig>(emptyRound);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadActiveRound().then((loaded) => {
      if (loaded !== null) setRound(loaded);
    });
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

  const startNewRound = (): void => {
    const suffix = new Date().toISOString().slice(0, 10);
    setRound({
      roundId: `round-${suffix}`,
      label: `PT25003 consultation, ${suffix}`,
      isActive: true,
      overrides: round.overrides,
    });
    setStatus('New round prepared. Responses already collected keep their own round and are untouched. Save to start it.');
  };

  return (
    <div className="mt-6 grid gap-5">
      <section className={card}>
        <h2 className="text-subtitle font-semibold">Consultation round</h2>
        <p className="mt-1 text-meta text-ink-soft">
          Starting a new round leaves every existing response exactly as it is. Results can then be filtered or compared
          by round.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="round-id" className="mb-1 block text-meta font-semibold text-ink-soft">
              Round id
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
              Round name
            </label>
            <input
              id="round-label"
              className={textInput}
              value={round.label}
              onChange={(event) => setRound({ ...round, label: event.target.value })}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className={primaryButton} onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : 'Save wording'}
          </button>
          <button type="button" className={secondaryButton} onClick={startNewRound}>
            Start a new round
          </button>
        </div>
        {status !== null && (
          <p className="mt-3 text-meta text-ink-soft" role="status">
            {status}
          </p>
        )}
      </section>

      {allSections(DEFAULT_QUESTIONNAIRE).map((section) => (
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
                  <p className="text-meta text-ink-faint">{question.id}</p>
                  <label htmlFor={`${question.id}-prompt`} className="mt-1 mb-1 block text-meta font-semibold text-ink-soft">
                    Question wording
                  </label>
                  <textarea
                    id={`${question.id}-prompt`}
                    className={textInput}
                    rows={2}
                    value={override.prompt ?? question.prompt}
                    onChange={(event) => setOverride(question.id, { prompt: event.target.value })}
                  />
                  <label htmlFor={`${question.id}-help`} className="mt-2 mb-1 block text-meta font-semibold text-ink-soft">
                    Guidance below the question
                  </label>
                  <input
                    id={`${question.id}-help`}
                    className={textInput}
                    value={override.help ?? question.help ?? ''}
                    onChange={(event) => setOverride(question.id, { help: event.target.value })}
                  />
                  {options.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-meta font-semibold text-primary">
                        Answer options ({options.length})
                      </summary>
                      <ul className="mt-2 grid gap-2">
                        {options.map((option) => (
                          <li key={option.id}>
                            <label htmlFor={`${question.id}-${option.id}`} className="mb-1 block text-meta text-ink-faint">
                              {option.id}
                            </label>
                            <input
                              id={`${question.id}-${option.id}`}
                              className={textInput}
                              value={override.optionLabels?.[option.id] ?? option.label}
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
        </section>
      ))}
    </div>
  );
};
