import { useId } from 'react';
import type { Answer, Option, Question } from '../types';
import { choiceRow, choiceRowSelected, textInput } from './ui';

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

const MultiField = ({ question, answer, onChange, promptOverride }: Props) => {
  const groupId = useId();
  const values = answer !== undefined && answer.kind === 'multi' ? answer.values : [];
  const other = answer !== undefined && answer.kind === 'multi' ? (answer.other ?? '') : '';
  const showOther = question.kind === 'multi' && question.allowOther === true && values.includes(OTHER_ID);

  const toggle = (optionId: string): void => {
    const next = values.includes(optionId) ? values.filter((value) => value !== optionId) : [...values, optionId];
    if (next.length === 0 && other.trim().length === 0) {
      onChange(undefined);
      return;
    }
    onChange({ kind: 'multi', values: next, other: next.includes(OTHER_ID) ? other : '' });
  };

  if (question.kind !== 'multi') return null;

  return (
    <fieldset aria-describedby={groupId}>
      <legend className="contents">
        <Prompt question={question} id={groupId} override={promptOverride} />
      </legend>
      <ul className="grid gap-2">
        {question.options.map((option) => {
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
            onChange={(event) => onChange({ kind: 'multi', values, other: event.target.value })}
          />
        </div>
      )}
    </fieldset>
  );
};

const SingleField = ({ question, answer, onChange }: Props) => {
  const groupId = useId();
  if (question.kind !== 'single') return null;
  const selected = answer !== undefined && answer.kind === 'single' ? answer.value : '';
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
                onChange={() => onChange({ kind: 'single', value: option.id })}
              />
              <span className="text-body text-ink">
                {option.label}
                <OptionHelp option={option} />
              </span>
            </label>
          </li>
        ))}
      </ul>
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
  if (question.kind !== 'rating') return null;
  const values = answer !== undefined && answer.kind === 'rating' ? answer.values : {};

  const set = (rowId: string, value: number): void =>
    onChange({ kind: 'rating', values: { ...values, [rowId]: value } });

  return (
    <fieldset>
      <legend className="contents">
        <Prompt question={question} id={groupId} />
      </legend>
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
      </ol>
      <p className="mt-2 text-meta text-ink-soft">
        1 = {question.scale[0]?.label}. 5 = {question.scale[question.scale.length - 1]?.label}.
      </p>
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
      return <TextField {...props} />;
    case 'rating':
      return <RatingField {...props} />;
    case 'rank':
      return <RankField {...props} />;
  }
};
