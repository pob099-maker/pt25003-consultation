import { useEffect, useRef } from 'react';
import type { Step } from '../hooks/useConsultation';
import { sectionStatus, type SectionStatus } from '../services/interviewNotes';
import type { AnswerMap } from '../types';

const MARK: Readonly<Record<SectionStatus, string>> = {
  current: '',
  done: '✓ ',
  started: '◐ ',
  untouched: '',
};

const SPOKEN: Readonly<Record<SectionStatus, string>> = {
  current: 'you are here',
  done: 'done',
  started: 'partly done',
  untouched: 'not started',
};

/**
 * Every section at once, so the interviewer can follow the conversation
 * instead of the form. People rarely answer in order: when a grower starts on
 * labour while you are asking about harvest, tap "labour" and write it down
 * there.
 */
export const InterviewNav = ({
  steps,
  current,
  answers,
  roleChosen,
  onJump,
}: {
  steps: readonly Step[];
  current: number;
  answers: AnswerMap;
  roleChosen: boolean;
  onJump: (index: number) => void;
}) => {
  const statuses = steps.map((step, index): SectionStatus => {
    if (index === current) return 'current';
    if (step.id === 'about_you') return roleChosen ? 'done' : 'untouched';
    if (step.id === 'stay_involved') return 'untouched';
    return sectionStatus(step.section, answers, false);
  });
  const done = statuses.filter((status) => status === 'done').length;
  const list = useRef<HTMLUListElement>(null);

  // On a phone the row scrolls sideways; keep the section on screen in view.
  useEffect(() => {
    const chip = list.current?.querySelector<HTMLElement>('[aria-current="step"]');
    chip?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }, [current]);

  return (
    <nav aria-label="Interview sections" className="mb-5 rounded-lg border border-line bg-surface p-3 no-print">
      <p className="mb-2 text-meta text-ink-soft">
        <strong className="text-ink">Jump to any section</strong> · {done} of {steps.length} done · ✓ done, ◐ partly
        <span className="sm:hidden"> · swipe for more</span>
      </p>
      <ul
        ref={list}
        className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        {steps.map((step, index) => {
          const status = statuses[index] ?? 'untouched';
          return (
            <li key={step.id}>
              <button
                type="button"
                aria-current={status === 'current' ? 'step' : undefined}
                aria-label={`${step.title}, ${SPOKEN[status]}`}
                onClick={() => onJump(index)}
                className={`min-h-10 shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-meta sm:whitespace-normal ${
                  status === 'current'
                    ? 'border-primary bg-primary font-semibold text-white'
                    : status === 'done'
                      ? 'border-primary bg-selected text-ink'
                      : status === 'started'
                        ? 'border-line-strong bg-selected text-ink'
                        : 'border-line bg-surface text-ink-soft'
                }`}
              >
                {MARK[status]}
                {step.title}
              </button>
            </li>
          );
        })}
      </ul>
      {!roleChosen && (
        <p className="mt-2 text-meta text-ink-soft">
          The questions for their part of the industry appear once you&rsquo;ve chosen their role in{' '}
          <em>{steps[0]?.title}</em>.
        </p>
      )}
    </nav>
  );
};
