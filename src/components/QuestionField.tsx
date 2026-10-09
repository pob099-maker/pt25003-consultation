import { useId } from 'react';
import type { Answer, Option, Question } from '../types';
import { OTHER_ROW, OTHER_ROW_LABEL, onScale } from '../content/lookup';
import { choiceRow, choiceRowSelected, textInput } from './ui';
import { LinkCodeField } from './LinkCodeField';

interface Props {
  readonly question: Question;
  readonly answer: Answer | undefined;
  readonly onChange: (answer: Answer | undefined) => void;
  /** Choices for a rank question, resolved from the question it draws on. */
  readonly rankChoices?: readonly Option[];
  /**
   * Replaces the written prompt with one naming what this respondent actually
   * chose earlier. "For the one at the top of your list" makes somebody scroll
   * back and guess; "For harvesting" does not.
   */
  readonly promptOverride?: string;
  /** A tick list's choices for this person, when an earlier answer narrows them. */
  readonly choices?: readonly Option[];
}

const OTHER_ID = 'other';

const Prompt = ({ question, id, override }: { question: Question; id: string; override?: string }) => (
  <div className="mb-3">
    <p id={id} className="text-subtitle font-semibold text-ink">
      {override ?? question.prompt}
    </p>
    {question.help !== undefined && <p className="mt-1 text-meta text-ink-soft">{question.help}</p>}
  </div>
);

const OptionHelp = ({ option }: { option: Option }) =>
  option.help === undefined ? null : <span className="mt-0.5 block text-meta text-ink-faint">{option.help}</span>;

/** The question's own box, under its choices. */
const NoteBox = ({
  id,
  label,
  rows,
  value,
  onChange,
}: {
  id: string;
  label: string;
  rows: number;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="mt-3">
    <label className="mb-1 block text-meta text-ink-soft" htmlFor={id}>
      {label}
    </label>
    {rows > 1 ? (
      <textarea id={id} className={textInput} rows={rows} maxLength={2000} value={value} onChange={(event) => onChange(event.target.value)} />
    ) : (
      <input id={id} className={textInput} type="text" maxLength={300} value={value} onChange={(event) => onChange(event.target.value)} />
    )}
  </div>
);

const MultiField = ({ question, answer, onChange, promptOverride, choices }: Props) => {
  const groupId = useId();
  const shown = choices ?? (question.kind === 'multi' ? question.options : []);
  // A tick left on a choice this person is no longer shown, after they changed
  // an earlier answer, goes with their next change rather than staying hidden.
  const values = (answer !== undefined && answer.kind === 'multi' ? answer.values : []).filter((value) =>
    shown.some((option) => option.id === value),
  );
  const other = answer !== undefined && answer.kind === 'multi' ? (answer.other ?? '') : '';
  const note = answer !== undefined && answer.kind === 'multi' ? (answer.note ?? '') : '';
  const showOther = question.kind === 'multi' && question.allowOther === true && values.includes(OTHER_ID);

  /** An example written with nothing ticked is still an answer, so the box keeps it. */
  const write = (nextValues: readonly string[], nextOther: string, nextNote: string): void => {
    if (nextValues.length === 0 && nextOther.trim().length === 0 && nextNote.trim().length === 0) {
      onChange(undefined);
      return;
    }
    onChange({ kind: 'multi', values: nextValues, other: nextOther, ...(nextNote.length > 0 ? { note: nextNote } : {}) });
  };

  const toggle = (optionId: string): void => {
    const next = values.includes(optionId) ? values.filter((value) => value !== optionId) : [...values, optionId];
    write(next, next.includes(OTHER_ID) ? other : '', note);
  };

  if (question.kind !== 'multi') return null;

  return (
    <fieldset aria-describedby={groupId}>
      <legend className="contents">
        <Prompt question={question} id={groupId} override={promptOverride} />
      </legend>
      <ul className="grid gap-2">
        {shown.map((option) => {
          const checked = values.includes(option.id);
          return (
            <li key={option.id}>
              <label className={`${choiceRow} cursor-pointer ${checked ? choiceRowSelected : ''}`}>
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 accent-primary"
                  checked={checked}
                  onChange={() => toggle(option.id)}
                />
                <span className="text-body text-ink">
                  {option.label}
                  <OptionHelp option={option} />
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {showOther && (
        <div className="mt-3">
          <label className="mb-1 block text-meta text-ink-soft" htmlFor={`${groupId}-other`}>
            Please describe the other option
          </label>
          <input
            id={`${groupId}-other`}
            className={textInput}
            type="text"
            value={other}
            maxLength={500}
            onChange={(event) => write(values, event.target.value, note)}
          />
        </div>
      )}
      {question.note !== undefined && (
        <NoteBox
          id={`${groupId}-note`}
          label={question.note.label}
          rows={question.note.rows ?? 3}
          value={note}
          onChange={(value) => write(values, other, value)}
        />
      )}
    </fieldset>
  );
};

const SingleField = ({ question, answer, onChange }: Props) => {
  const groupId = useId();
  if (question.kind !== 'single') return null;
  const selected = answer !== undefined && answer.kind === 'single' ? answer.value : '';
  const note = answer !== undefined && answer.kind === 'single' ? (answer.note ?? '') : '';
  const choose = (value: string, nextNote: string): void =>
    onChange({ kind: 'single', value, ...(nextNote.length > 0 ? { note: nextNote } : {}) });
  return (
    <fieldset>
      <legend className="contents">
        <Prompt question={question} id={groupId} />
      </legend>
      <ul className="grid gap-2">
        {question.options.map((option) => (
          <li key={option.id}>
            <label className={`${choiceRow} cursor-pointer ${selected === option.id ? choiceRowSelected : ''}`}>
              <input
                type="radio"
                name={groupId}
                className="mt-1 size-5 shrink-0 accent-primary"
                checked={selected === option.id}
                onChange={() => choose(option.id, note)}
              />
              <span className="text-body text-ink">
                {option.label}
                <OptionHelp option={option} />
              </span>
            </label>
          </li>
        ))}
      </ul>
      {/* Once something is chosen, so the words always belong to an answer. */}
      {question.note !== undefined && selected !== '' && (
        <NoteBox
          id={`${groupId}-note`}
          label={question.note.label}
          rows={question.note.rows ?? 1}
          value={note}
          onChange={(value) => choose(selected, value)}
        />
      )}
    </fieldset>
  );
};

const TextField = ({ question, answer, onChange }: Props) => {
  const fieldId = useId();
  if (question.kind !== 'text') return null;
  const value = answer !== undefined && answer.kind === 'text' ? answer.value : '';
  return (
    <div>
      <label htmlFor={fieldId}>
        <Prompt question={question} id={`${fieldId}-prompt`} />
      </label>
      <textarea
        id={fieldId}
        className={textInput}
        rows={question.rows ?? 3}
        maxLength={4000}
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next.length === 0 ? undefined : { kind: 'text', value: next });
        }}
      />
      <p className="mt-1 text-meta text-ink-faint">Optional. Leave blank if it does not apply to you.</p>
    </div>
  );
};

const RatingField = ({ question, answer, onChange }: Props) => {
  const groupId = useId();
  const otherId = useId();
  if (question.kind !== 'rating') return null;
  const values = answer !== undefined && answer.kind === 'rating' ? answer.values : {};
  const other = answer !== undefined && answer.kind === 'rating' ? (answer.other ?? '') : '';
  const named = other.trim().length > 0;

  /** A step for "something else" means nothing without what it was, so the two travel together. */
  const write = (nextValues: Readonly<Record<string, number>>, nextOther: string): void => {
    const hasName = nextOther.trim().length > 0;
    const kept = hasName ? nextValues : Object.fromEntries(Object.entries(nextValues).filter(([id]) => id !== OTHER_ROW));
    if (Object.keys(kept).length === 0 && !hasName) {
      onChange(undefined);
      return;
    }
    onChange({ kind: 'rating', values: kept, ...(hasName ? { other: nextOther } : {}) });
  };

  const set = (rowId: string, value: number): void => write({ ...values, [rowId]: value }, other);

  return (
    <fieldset>
      <legend className="contents">
        <Prompt question={question} id={groupId} />
      </legend>
      {question.labelEveryStep === true && (
        <ol className="mb-3 grid gap-1 rounded-md bg-sunk p-3 text-meta text-ink" aria-label="What each number means">
          {question.scale.map((point) => (
            <li key={point.value} className="flex gap-2">
              <span className="w-4 shrink-0 font-semibold tabular-nums">{point.value}</span>
              <span>{point.label}</span>
            </li>
          ))}
        </ol>
      )}
      <ol className="grid gap-3">
        {question.rows.map((row) => (
          <li key={row.id} className="rounded-md border border-line bg-surface p-3">
            <p className="text-body font-medium text-ink">
              {row.label}
              <OptionHelp option={row} />
            </p>
            <div className="mt-2 flex gap-1.5" role="group" aria-label={row.label}>
              {question.scale.map((point) => {
                const active = values[row.id] === point.value;
                return (
                  <button
                    key={point.value}
                    type="button"
                    aria-pressed={active}
                    aria-label={`${point.value}, ${point.label}`}
                    onClick={() => set(row.id, point.value)}
                    className={`flex-1 rounded-md border py-3 text-body font-semibold min-h-12 ${
                      active ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink'
                    }`}
                  >
                    {point.value}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-meta text-ink-faint">
              {values[row.id] === undefined
                ? 'Not yet rated'
                : (question.scale.find((point) => point.value === values[row.id])?.label ?? '')}
            </p>
          </li>
        ))}
        {question.allowOther === true && (
          <li className="rounded-md border border-line bg-surface p-3">
            <label htmlFor={otherId} className="block text-body font-medium text-ink">
              {OTHER_ROW_LABEL}
              <span className="mt-0.5 block text-meta text-ink-faint">
                Anything we have missed. Say what it is, then pick the step.
              </span>
            </label>
            <input
              id={otherId}
              className={`${textInput} mt-2`}
              value={other}
              maxLength={500}
              onChange={(event) => write(values, event.target.value)}
            />
            <div className="mt-2 flex gap-1.5" role="group" aria-label={named ? other.trim() : OTHER_ROW_LABEL}>
              {question.scale.map((point) => {
                const active = values[OTHER_ROW] === point.value;
                return (
                  <button
                    key={point.value}
                    type="button"
                    aria-pressed={active}
                    aria-label={`${point.value}, ${point.label}`}
                    disabled={!named}
                    onClick={() => set(OTHER_ROW, point.value)}
                    className={`flex-1 rounded-md border py-3 text-body font-semibold min-h-12 ${
                      !named
                        ? 'cursor-not-allowed border-line bg-sunk text-ink-faint'
                        : active
                          ? 'border-primary bg-primary text-white'
                          : 'border-line-strong bg-surface text-ink'
                    }`}
                  >
                    {point.value}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-meta text-ink-faint">
              {!named
                ? 'Write what it is first'
                : values[OTHER_ROW] === undefined
                  ? 'Not yet rated'
                  : (question.scale.find((point) => point.value === values[OTHER_ROW])?.label ?? '')}
            </p>
          </li>
        )}
      </ol>
      {question.labelEveryStep !== true && (
        <p className="mt-2 text-meta text-ink-soft">
          {question.scale[0]?.value} = {question.scale[0]?.label}. {onScale(question.scale).at(-1)?.value} ={' '}
          {onScale(question.scale).at(-1)?.label}.
        </p>
      )}
    </fieldset>
  );
};

const RankField = ({ question, answer, onChange, rankChoices }: Props) => {
  const groupId = useId();
  if (question.kind !== 'rank') return null;
  const chosen = answer !== undefined && answer.kind === 'rank' ? answer.values : [];
  const choices = rankChoices !== undefined && rankChoices.length > 0 ? rankChoices : question.fallbackOptions;

  const toggle = (optionId: string): void => {
    if (chosen.includes(optionId)) {
      const next = chosen.filter((value) => value !== optionId);
      onChange(next.length === 0 ? undefined : { kind: 'rank', values: next });
      return;
    }
    if (chosen.length >= question.count) return;
    onChange({ kind: 'rank', values: [...chosen, optionId] });
  };

  const full = chosen.length >= question.count;

  return (
    <fieldset>
      <legend className="contents">
        <Prompt question={question} id={groupId} />
      </legend>
      <p className="mb-2 text-meta text-ink-soft" aria-live="polite">
        {chosen.length} of {question.count} chosen.
        {full ? ' Remove one to swap it for something else.' : ''}
      </p>
      <ul className="grid gap-2">
        {choices.map((option) => {
          const position = chosen.indexOf(option.id);
          const selected = position >= 0;
          return (
            <li key={option.id}>
              <button
                type="button"
                aria-pressed={selected}
                disabled={!selected && full}
                onClick={() => toggle(option.id)}
                className={`${choiceRow} ${selected ? choiceRowSelected : ''} ${
                  !selected && full ? 'opacity-55' : ''
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-meta font-bold ${
                    selected ? 'border-primary bg-primary text-white' : 'border-line-strong text-ink-faint'
                  }`}
                >
                  {selected ? position + 1 : ''}
                </span>
                <span className="text-body text-ink">
                  {selected ? `${position + 1}. ` : ''}
                  {option.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
};

export const QuestionField = (props: Props) => {
  switch (props.question.kind) {
    case 'multi':
      return <MultiField {...props} />;
    case 'single':
      return <SingleField {...props} />;
    case 'text':
      return props.question.entry === 'linkCode' ? <LinkCodeField {...props} /> : <TextField {...props} />;
    case 'rating':
      return <RatingField {...props} />;
    case 'rank':
      return <RankField {...props} />;
  }
};
