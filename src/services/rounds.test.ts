import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { questionById, trackingQuestions } from '../content/lookup';
import { applyRound, type RoundConfig } from './rounds';

describe('applyRound', () => {
  const round: RoundConfig = {
    roundId: 'round-2',
    label: 'Second round',
    stage: 'review',
    isActive: true,
    overrides: {
      q3_impact: {
        prompt: 'What does it cost you?',
        optionLabels: { labour_cost: 'Wages' },
        addedOptions: [{ id: 'insurance', label: 'Insurance' }],
      },
    },
  };

  it('replaces wording without changing the id an answer points at', () => {
    const updated = applyRound(DEFAULT_QUESTIONNAIRE, round);
    const question = questionById(updated, 'q3_impact');
    expect(question?.prompt).toBe('What does it cost you?');
    if (question?.kind !== 'multi') throw new Error('expected a multi-select question');
    const wages = question.options.find((option) => option.id === 'labour_cost');
    expect(wages?.label).toBe('Wages');
    expect(wages?.id).toBe('labour_cost');
  });

  it('keeps every original option, so a historic answer still resolves', () => {
    const before = questionById(DEFAULT_QUESTIONNAIRE, 'q3_impact');
    const after = questionById(applyRound(DEFAULT_QUESTIONNAIRE, round), 'q3_impact');
    if (before?.kind !== 'multi' || after?.kind !== 'multi') throw new Error('expected multi-select questions');
    for (const option of before.options) {
      expect(after.options.some((candidate) => candidate.id === option.id)).toBe(true);
    }
    expect(after.options.some((option) => option.id === 'insurance')).toBe(true);
  });

  it('leaves questions with no override untouched', () => {
    const updated = applyRound(DEFAULT_QUESTIONNAIRE, round);
    expect(questionById(updated, 'q4_bad_season')?.prompt).toBe(
      questionById(DEFAULT_QUESTIONNAIRE, 'q4_bad_season')?.prompt,
    );
  });

  it('stamps the round id and stage, so responses are attributed and compared correctly', () => {
    const updated = applyRound(DEFAULT_QUESTIONNAIRE, round);
    expect(updated.roundId).toBe('round-2');
    expect(updated.stage).toBe('review');
  });
});

describe('tracked questions', () => {
  it('ignore every override, so the baseline stays comparable with each review', () => {
    // The admin editor locks these, but a lock that lives only in the screen is
    // one a stored override from before the lock can walk straight past. The
    // data layer refuses as well.
    const tampered: RoundConfig = {
      roundId: 'round-3',
      label: 'Third',
      stage: 'review',
      isActive: true,
      overrides: {
        q1_constraints: {
          prompt: 'Something different',
          optionLabels: { harvest: 'Lifting' },
          addedOptions: [{ id: 'weather', label: 'Weather' }],
        },
      },
    };
    const before = questionById(DEFAULT_QUESTIONNAIRE, 'q1_constraints');
    const after = questionById(applyRound(DEFAULT_QUESTIONNAIRE, tampered), 'q1_constraints');
    expect(after).toEqual(before);
  });

  it('cover the measures the evaluation depends on', () => {
    const ids = trackingQuestions(DEFAULT_QUESTIONNAIRE).map((question) => question.id);
    for (const required of ['q1_constraints', 'q5_areas', 'q7_evidence', 'q_trial', 'q_trust', 'farm_adopted', 'fu_changed']) {
      expect(ids).toContain(required);
    }
  });

  it('are never open text, because a paragraph cannot be counted across rounds', () => {
    for (const question of trackingQuestions(DEFAULT_QUESTIONNAIRE)) {
      expect(question.kind, question.id).not.toBe('text');
    }
  });
});

describe('follow-up questions', () => {
  it('exist for review rounds and are not part of the baseline trunk', () => {
    const followUpIds = DEFAULT_QUESTIONNAIRE.followUp.flatMap((section) => section.questions.map((q) => q.id));
    const coreIds = DEFAULT_QUESTIONNAIRE.core.flatMap((section) => section.questions.map((q) => q.id));
    expect(followUpIds).toContain('fu_seen');
    expect(coreIds).not.toContain('fu_seen');
  });
});
