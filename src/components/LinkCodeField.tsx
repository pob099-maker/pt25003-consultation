import { useId, useState } from 'react';
import type { Answer, Question } from '../types';
import {
  EMPTY_PARTS,
  buildLinkCode,
  isStarted,
  partsOf,
  twoLetters,
  type LinkCodeParts,
} from '../services/linkCode';
import { secondaryButton, textInput } from './ui';

interface Props {
  readonly question: Question;
  readonly answer: Answer | undefined;
  readonly onChange: (answer: Answer | undefined) => void;
}

const DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1));

/**
 * The anonymous follow-up code, asked as three small questions rather than as
 * a code to type.
 *
 * The letter boxes deliberately have no character limit. With one, a space
 * typed quickly (or added by a phone keyboard after a word) briefly fills the
 * second slot and the browser swallows the next letter, so "b a" came out as
 * "B". The cleaning keeps the first two letters instead, which also means
 * typing a whole name or town works. Each box only accepts what it asks for, the form puts the
 * pieces together in one fixed order, and the person sees the result before
 * they move on. Nothing is kept until all three are there: half a code links
 * nothing and would only look like a mistake later.
 */
export const LinkCodeField = ({ question, answer, onChange }: Props) => {
  const baseId = useId();
  const stored = answer !== undefined && answer.kind === 'text' ? answer.value : '';
  const [parts, setParts] = useState<LinkCodeParts>(() => partsOf(stored));
  const code = buildLinkCode(parts);
  const unfinished = code === null && isStarted(parts);

  const update = (next: LinkCodeParts): void => {
    setParts(next);
    const built = buildLinkCode(next);
    onChange(built === null ? undefined : { kind: 'text', value: built });
  };

  const clear = (): void => update(EMPTY_PARTS);

  return (
    <fieldset aria-describedby={`${baseId}-help`}>
      <legend className="mb-1 text-subtitle font-semibold text-ink">{question.prompt}</legend>
      {question.help !== undefined && (
        <p id={`${baseId}-help`} className="mb-4 text-meta text-ink-soft">
          {question.help}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`${baseId}-mother`} className="mb-1 block text-body font-medium text-ink">
            First two letters of your mother&rsquo;s first name
          </label>
          <p id={`${baseId}-mother-hint`} className="mb-1 text-meta text-ink-soft">
            Or whoever raised you. We only keep the first two letters.
          </p>
          <input
            id={`${baseId}-mother`}
            className={`${textInput} uppercase tracking-widest`}
            aria-describedby={`${baseId}-mother-hint`}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={parts.mother}
            onChange={(event) => update({ ...parts, mother: twoLetters(event.target.value) })}
          />
        </div>

        <div>
          <label htmlFor={`${baseId}-day`} className="mb-1 block text-body font-medium text-ink">
            The day of the month you were born
          </label>
          <p id={`${baseId}-day-hint`} className="mb-1 text-meta text-ink-soft">
            Just the day, not the month or the year.
          </p>
          <select
            id={`${baseId}-day`}
            className={textInput}
            aria-describedby={`${baseId}-day-hint`}
            value={parts.day}
            onChange={(event) => update({ ...parts, day: event.target.value })}
          >
            <option value="">Choose a day</option>
            {DAYS.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${baseId}-town`} className="mb-1 block text-body font-medium text-ink">
            First two letters of the town you grew up in
          </label>
          <p id={`${baseId}-town-hint`} className="mb-1 text-meta text-ink-soft">
            Where you grew up, not where you live now, so it stays the same.
          </p>
          <input
            id={`${baseId}-town`}
            className={`${textInput} uppercase tracking-widest`}
            aria-describedby={`${baseId}-town-hint`}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={parts.town}
            onChange={(event) => update({ ...parts, town: twoLetters(event.target.value) })}
          />
        </div>
      </div>

      <div className="mt-4" aria-live="polite">
        {code !== null && (
          <p className="rounded-lg border border-primary bg-selected px-4 py-3 text-body text-ink">
            Your code is <strong className="font-display tracking-widest">{code}</strong>. That is all we keep.
          </p>
        )}
        {unfinished && (
          <p className="text-meta text-ink-soft">Fill in all three, or clear them if you would rather skip this.</p>
        )}
      </div>

      {isStarted(parts) && (
        <button type="button" className={`${secondaryButton} mt-3`} onClick={clear}>
          Clear my code
        </button>
      )}
    </fieldset>
  );
};
