import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { secondaryButton, textInput } from '../../components/ui';
import { everyRow, newRowId, newRowSchema, type NewRow, type QuestionOverride, type RoundConfig } from '../../services/rounds';
import type { ConsultationResponse, Option, Question } from '../../types';

type RatingQuestion = Extract<Question, { kind: 'rating' }>;

interface Props {
  /** The question as every round starts it, before any round's additions. */
  readonly question: RatingQuestion;
  readonly override: QuestionOverride;
  /** Every round so far, so a row added in one of them can be asked again. */
  readonly history: readonly RoundConfig[];
  /** The round on screen. */
  readonly current: RoundConfig;
  readonly responses: readonly ConsultationResponse[];
  readonly onChange: (patch: Partial<QuestionOverride>) => void;
}

/**
 * The rows of a watch list, for the round on screen.
 *
 * The question and every row already asked keep their words. What a round can
 * change is which rows it asks, and what it adds. A row with answers can be
 * stopped but never removed: its answers point at it, and a row nobody can
 * find is a row nobody reports.
 */
export const WatchListRows = ({ question, override, history, current, responses, onChange }: Props) => {
  const baseId = useId();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<NewRow>({ resolver: zodResolver(newRowSchema), defaultValues: { label: '', help: '' } });

  const earlier = history.filter((entry) => entry.roundId !== current.roundId);
  const rows = everyRow(question, [...earlier, current]);
  const own = new Set(question.rows.map((row) => row.id));
  const addedHere = override.addedOptions ?? [];
  const stopped = new Set(override.retiredOptions ?? []);

  const definedHere = (rowId: string): boolean => addedHere.some((row) => row.id === rowId);
  const isAsked = (rowId: string): boolean => (own.has(rowId) || definedHere(rowId)) && !stopped.has(rowId);
  const askedCount = rows.filter((row) => isAsked(row.id)).length;
  const firstRound = (rowId: string): RoundConfig | undefined =>
    earlier.find((entry) => (entry.overrides[question.id]?.addedOptions ?? []).some((row) => row.id === rowId));

  // Every row id an answer already uses, so a new row can never take one.
  const answeredIds = new Set<string>();
  for (const response of responses) {
    const answer = response.answers[question.id];
    if (answer?.kind === 'rating') for (const id of Object.keys(answer.values)) answeredIds.add(id);
  }

  const toggle = (row: Option, ask: boolean): void => {
    if (!ask) {
      onChange({ retiredOptions: [...stopped, row.id] });
      return;
    }
    const needsDefinition = !own.has(row.id) && !definedHere(row.id);
    onChange({
      addedOptions: needsDefinition ? [...addedHere, row] : addedHere,
      retiredOptions: [...stopped].filter((id) => id !== row.id),
    });
  };

  const remove = (rowId: string): void =>
    onChange({
      addedOptions: addedHere.filter((row) => row.id !== rowId),
      retiredOptions: [...stopped].filter((id) => id !== rowId),
    });

  const add = handleSubmit((values) => {
    if (rows.some((row) => row.label.trim().toLowerCase() === values.label.toLowerCase())) {
      setError('label', { message: 'That is already on the list. Tick it to ask it in this round.' });
      return;
    }
    const id = newRowId(values.label, new Set([...rows.map((row) => row.id), ...answeredIds]));
    onChange({
      addedOptions: [...addedHere, { id, label: values.label, ...(values.help.length > 0 ? { help: values.help } : {}) }],
    });
    reset();
  });

  const note = (row: Option): string | null => {
    if (own.has(row.id)) return null;
    const from = firstRound(row.id);
    return from === undefined ? 'Added in this round' : `Added in ${from.label}`;
  };

  return (
    <div className="mt-3">
      <p className="text-meta font-semibold text-ink-soft">Tick what this round asks</p>
      <ul className="mt-2 grid gap-2">
        {rows.map((row) => {
          const asked = isAsked(row.id);
          const removable = definedHere(row.id) && firstRound(row.id) === undefined && !answeredIds.has(row.id);
          const detail = note(row);
          return (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-2">
              <label className="flex items-start gap-2 text-body text-ink">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-primary"
                  checked={asked}
                  // A list always keeps at least one line to answer.
                  disabled={asked && askedCount <= 1}
                  onChange={(event) => toggle(row, event.target.checked)}
                />
                <span>
                  {row.label}
                  {detail !== null && <span className="block text-meta text-ink-faint">{detail}</span>}
                </span>
              </label>
              {removable && (
                <button type="button" className={secondaryButton} onClick={() => remove(row.id)}>
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <form className="mt-4 grid gap-3 rounded-md border border-line bg-sunk p-3" onSubmit={(event) => void add(event)} noValidate>
        <p className="text-meta font-semibold text-ink">Add something new to the list</p>
        <div>
          <label htmlFor={`${baseId}-label`} className="mb-1 block text-meta font-semibold text-ink-soft">
            What people will read
          </label>
          <input
            id={`${baseId}-label`}
            className={textInput}
            aria-invalid={errors.label !== undefined}
            aria-describedby={errors.label === undefined ? undefined : `${baseId}-label-error`}
            {...register('label')}
          />
          {errors.label !== undefined && (
            <p id={`${baseId}-label-error`} className="mt-1 text-meta font-medium text-danger" role="alert">
              {errors.label.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${baseId}-help`} className="mb-1 block text-meta font-semibold text-ink-soft">
            A few plain words underneath, if it needs explaining (optional)
          </label>
          <input
            id={`${baseId}-help`}
            className={textInput}
            aria-invalid={errors.help !== undefined}
            aria-describedby={errors.help === undefined ? undefined : `${baseId}-help-error`}
            {...register('help')}
          />
          {errors.help !== undefined && (
            <p id={`${baseId}-help-error`} className="mt-1 text-meta font-medium text-danger" role="alert">
              {errors.help.message}
            </p>
          )}
        </div>
        <p className="text-meta text-ink-soft">
          Best done when a round starts, so everybody in it sees the same list. Once anybody has answered it, the words
          are fixed: if the technology changes, stop this line and add a new one.
        </p>
        <div>
          <button type="submit" className={secondaryButton}>
            Add to the list
          </button>
        </div>
      </form>
    </div>
  );
};
