import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from './questionnaire';
import { questionById } from './lookup';
import { choicesFor, promptOverrideFor } from './dynamic';
import type { AnswerMap, Option } from '../types';

const q = DEFAULT_QUESTIONNAIRE;
const problems = questionById(q, 'q1_constraints');
const costs = questionById(q, 'q3_impact');
if (problems?.kind !== 'multi' || costs?.kind !== 'multi') throw new Error('q1 and q3 must be tick lists');

const topIs = (id: string): AnswerMap => ({ q2_top_three: { kind: 'rank', values: [id] } });
const shownFor = (id: string): readonly Option[] => choicesFor(costs, topIs(id)) ?? costs.options;

/** Words that carry meaning, so a shared "and" or "getting" does not count. */
const STOP = new Set(['with', 'that', 'each', 'other', 'getting', 'what', 'actually', 'from', 'into', 'more', 'than']);
const words = (label: string): Set<string> =>
  new Set(
    label
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length >= 4 && !STOP.has(word)),
  );

/**
 * Pairs that share a word and are still a cost, not the problem again: a loss
 * in handling is what storage and handling going wrong costs.
 */
const FINE = new Set(['storage:damage']);

describe('what the top problem costs', () => {
  it('says which problem it is asking about', () => {
    expect(promptOverrideFor(q, costs, topIs('skills'))).toBe(
      'Thinking about finding skilled operators and technicians — what does it actually cost a business?',
    );
  });

  it('never offers labour availability as the cost of finding skilled operators', () => {
    const ids = shownFor('skills').map((option) => option.id);
    expect(ids).not.toContain('labour_avail');
    expect(ids).toContain('training');
    expect(ids).toContain('labour_cost');
  });

  it('offers the whole list for every other problem', () => {
    expect(choicesFor(costs, topIs('harvest'))).toBeUndefined();
    expect(choicesFor(costs, {})).toBeUndefined();
  });

  it('never offers a problem back to somebody as its own cost', () => {
    // "Trouble finding skilled operators" was once a cost of finding skilled
    // operators, and "machine reliability" one of machinery reliability.
    const circular = problems.options
      .filter((problem) => problem.id !== 'other')
      .flatMap((problem) =>
        shownFor(problem.id)
          .filter((cost) => cost.id !== 'other' && !FINE.has(`${problem.id}:${cost.id}`))
          .filter((cost) => [...words(cost.label)].some((word) => words(problem.label).has(word)))
          .map((cost) => `${problem.label} → ${cost.label}`),
      );
    expect(circular).toEqual([]);
  });
});
