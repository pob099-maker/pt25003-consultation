import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { questionById } from '../content/lookup';
import { applyRound } from './rounds';

describe('applyRound', () => {
  const round = {
    roundId: 'round-2',
    label: 'Second round',
    isActive: true,
    overrides: {
      q1_constraints: {
        prompt: 'Where are the biggest hold-ups?',
        optionLabels: { harvesting: 'Lifting' },
        addedOptions: [{ id: 'weather', label: 'Weather windows' }],
      },
    },
  };

  it('replaces wording without changing the id an answer points at', () => {
    const updated = applyRound(DEFAULT_QUESTIONNAIRE, round);
    const question = questionById(updated, 'q1_constraints');
    expect(question?.prompt).toBe('Where are the biggest hold-ups?');
    if (question?.kind !== 'multi') throw new Error('expected a multi-select question');
    const harvesting = question.options.find((option) => option.id === 'harvesting');
    expect(harvesting?.label).toBe('Lifting');
    expect(harvesting?.id).toBe('harvesting');
  });

  it('keeps every original option, so a historic answer still resolves', () => {
    const before = questionById(DEFAULT_QUESTIONNAIRE, 'q1_constraints');
    const after = questionById(applyRound(DEFAULT_QUESTIONNAIRE, round), 'q1_constraints');
    if (before?.kind !== 'multi' || after?.kind !== 'multi') throw new Error('expected multi-select questions');
    for (const option of before.options) {
      expect(after.options.some((candidate) => candidate.id === option.id)).toBe(true);
    }
    expect(after.options.some((option) => option.id === 'weather')).toBe(true);
  });

  it('leaves questions with no override untouched', () => {
    const updated = applyRound(DEFAULT_QUESTIONNAIRE, round);
    expect(questionById(updated, 'q4_bad_season')?.prompt).toBe(
      questionById(DEFAULT_QUESTIONNAIRE, 'q4_bad_season')?.prompt,
    );
  });

  it('stamps the new round id, so responses are attributed to it', () => {
    expect(applyRound(DEFAULT_QUESTIONNAIRE, round).roundId).toBe('round-2');
  });
});
