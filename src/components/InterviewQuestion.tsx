import { useId } from 'react';
import type { Answer, AnswerMap, Question, Questionnaire } from '../types';
import { guideOverrideFor, promptOverrideFor, rankChoicesFor } from '../content/dynamic';
import { QuestionField } from './QuestionField';
import { card, textInput } from './ui';
import { markMention, mentionState } from '../services/mentions';

const DEFAULT_PROBE: Readonly<Record<Question['kind'], string>> = {
  multi: 'Anything else? And which of those bites hardest?',
  single: 'What makes you say that?',
  text: 'Can you give me an example of when that happened?',
  rating: 'Which of those would you put at the very top?',
  rank: 'Why that one first?',
};

const OTHER_ID = 'other';

interface Props {
  readonly questionnaire: Questionnaire;
  readonly question: Question;
  readonly answers: AnswerMap;
  readonly onChange: (answer: Answer | undefined) => void;
  /** Already came up in the conversation, so it is confirmed rather than asked. */
  readonly covered?: boolean;
  /** Asked in every round: shown so the interviewer makes sure to cover it. */
  readonly mustAsk?: boolean;
  readonly onToggleCovered?: () => void;
}

/**
 * One question, as a conversation rather than a form.
 *
 * The interviewer sees how to raise it, one probe, and — for a list — what to
 * listen for. The list is not read out. Each item can be marked as raised
 * unprompted, or only once the list was read, because "nine growers raised
 * harvester damage before anyone mentioned it" is a stronger finding than
 * "nine ticked it" — and it is the one thing a conversation can measure that a
 * form cannot. For comparison with the online form, both count as mentioned.
 *
 * Ratings and rankings are read as written: a scale only compares if everyone
 * hears the same scale.
 */
export const InterviewQuestion = ({
  questionnaire,
  question,
  answers,
  onChange,
  covered = false,
  mustAsk = false,
  onToggleCovered,
}: Props) => {
  const groupId = useId();
  const answer = answers[question.id];
  const open = guideOverrideFor(questionnaire, question, answers) ?? question.guide?.open ?? question.prompt;
  const probe = question.guide?.probe ?? DEFAULT_PROBE[question.kind];

  const coveredToggle =
    onToggleCovered === undefined ? null : (
      <button
        type="button"
        aria-pressed={covered}
        onClick={onToggleCovered}
        className={`shrink-0 rounded-md border px-3 py-1.5 text-meta font-semibold ${
          covered ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface text-ink'
        }`}
      >
        {covered ? '✓ Came up earlier' : 'Came up earlier'}
      </button>
    );

  // Once it has come up, there is nothing to open with: the interviewer only
  // checks they heard it right, which is quicker and does not repeat them.
  const guide = covered ? (
    <div className="mb-3 flex flex-col items-start gap-3 rounded-lg border-l-4 sm:flex-row sm:justify-between border-primary bg-selected px-4 py-3">
      <div className="w-full min-w-0 sm:flex-1">
        <p className="text-eyebrow uppercase text-ink-faint">Already came up — just check</p>
        <p className="text-body text-ink">
          &ldquo;Earlier you mentioned … — have I got that right?&rdquo; <span className="text-ink-soft">({open})</span>
        </p>
      </div>
      {coveredToggle}
    </div>
  ) : (
    <div className="mb-3 flex flex-col items-start gap-3 rounded-lg border-l-4 sm:flex-row sm:justify-between border-accent bg-sunk px-4 py-3">
      <div className="w-full min-w-0 sm:flex-1">
        <p className="flex flex-wrap items-center gap-2 text-eyebrow uppercase text-ink-faint">
          Open with
          {mustAsk && (
            <span className="rounded-full border border-primary px-2 py-0.5 normal-case tracking-normal text-primary-ink">
              Must ask — tracked every round
            </span>
          )}
        </p>
        <p className="text-subtitle font-semibold text-ink">&ldquo;{open}&rdquo;</p>
        <p className="mt-2 text-eyebrow uppercase text-ink-faint">Then probe</p>
        <p className="text-body text-ink-soft">&ldquo;{probe}&rdquo;</p>
      </div>
      {coveredToggle}
    </div>
  );

  if (question.kind !== 'multi') {
    return (
      <section className={card} aria-labelledby={groupId}>
        <h3 id={groupId} className="sr-only">
          {question.prompt}
        </h3>
        {guide}
        {(question.kind === 'rating' || question.kind === 'rank') && (
          <p className="mb-2 text-meta font-semibold text-ink-soft">
            Read this one as written, so everyone hears the same scale.
          </p>
        )}
        {question.kind === 'text' && (
          <p className="mb-2 text-meta font-semibold text-ink-soft">Write it in their words, not yours.</p>
        )}
        <QuestionField
          question={question}
          answer={answer}
          onChange={onChange}
          rankChoices={question.kind === 'rank' ? rankChoicesFor(questionnaire, answers) : undefined}
          promptOverride={promptOverrideFor(questionnaire, question, answers)}
        />
      </section>
    );
  }

  const values = answer?.kind === 'multi' ? answer.values : [];
  const prompted = answer?.kind === 'multi' ? (answer.prompted ?? []) : [];
  const other = answer?.kind === 'multi' ? (answer.other ?? '') : '';

  const write = (nextValues: readonly string[], nextPrompted: readonly string[], nextOther: string): void => {
    if (nextValues.length === 0 && nextOther.trim().length === 0) {
      onChange(undefined);
      return;
    }
    onChange({
      kind: 'multi',
      values: nextValues,
      prompted: nextPrompted.filter((id) => nextValues.includes(id)),
      other: nextValues.includes(OTHER_ID) ? nextOther : '',
    });
  };

  const mark = (id: string, how: 'unprompted' | 'prompted'): void => {
    const next = markMention({ values, prompted }, id, how);
    write(next.values, next.prompted, other);
  };

  const unpromptedCount = values.filter((id) => !prompted.includes(id)).length;

  return (
    <section className={card} aria-labelledby={groupId}>
      <h3 id={groupId} className="sr-only">
        {question.prompt}
      </h3>
      {guide}
      <p className="text-meta font-semibold text-ink-soft">
        Listen for these — don&rsquo;t read them out. Mark what they raise. If they&rsquo;re stuck, read the list and
        mark anything else as <em>after prompting</em>.
      </p>
      <p className="mt-1 text-meta text-ink-faint" aria-live="polite">
        {values.length === 0
          ? 'Nothing marked yet.'
          : `${values.length} mentioned · ${unpromptedCount} unprompted · ${values.length - unpromptedCount} after prompting`}
      </p>
      <ul className="mt-3 grid gap-2">
        {question.options.map((option) => {
          const state = mentionState({ values, prompted }, option.id);
          return (
            <li
              key={option.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${
                state === 'none' ? 'border-line bg-surface' : 'border-primary bg-selected'
              }`}
            >
              <span className="min-w-0 flex-1 text-body text-ink">{option.label}</span>
              <span className="flex gap-1.5" role="group" aria-label={option.label}>
                <button
                  type="button"
                  aria-pressed={state === 'unprompted'}
                  onClick={() => mark(option.id, 'unprompted')}
                  className={`min-h-11 rounded-md border px-3 text-meta font-semibold ${
                    state === 'unprompted'
                      ? 'border-primary bg-primary text-white'
                      : 'border-line-strong bg-surface text-ink'
                  }`}
                >
                  Raised it
                </button>
                <button
                  type="button"
                  aria-pressed={state === 'prompted'}
                  onClick={() => mark(option.id, 'prompted')}
                  className={`min-h-11 rounded-md border px-3 text-meta font-semibold ${
                    state === 'prompted'
                      ? 'border-primary bg-primary text-white'
                      : 'border-line-strong bg-surface text-ink'
                  }`}
                >
                  After prompting
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {values.includes(OTHER_ID) && (
        <div className="mt-3">
          <label htmlFor={`${groupId}-other`} className="mb-1 block text-meta text-ink-soft">
            What was the other thing, in their words?
          </label>
          <input
            id={`${groupId}-other`}
            className={textInput}
            value={other}
            maxLength={500}
            onChange={(event) => write(values, prompted, event.target.value)}
          />
        </div>
      )}
    </section>
  );
};
