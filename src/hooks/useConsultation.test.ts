import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { applyRound } from '../services/roundRules';
import { keepAsked, settleDraft, type Draft } from './useConsultation';

const q = DEFAULT_QUESTIONNAIRE;

const draft = (over: Partial<Draft>): Draft => ({
  progressId: 'progress',
  responseId: 'response',
  startedAt: '2026-09-29T00:00:00.000Z',
  roundId: q.roundId,
  roundConfirmed: false,
  role: 'grower',
  regions: [],
  regionOther: '',
  answers: {},
  stepIndex: 3,
  ...over,
});

const pilot = applyRound(q, { roundId: '2026-pilot', label: 'Pilot', stage: 'pilot', overrides: {} });

describe('settleDraft', () => {
  it('keeps the answers of somebody who reloaded before the live round arrived', () => {
    // The page reloads, the compiled questions show first, and the draft was
    // saved under the live round. It must be carried on, not thrown away.
    const saved = draft({
      roundId: '2026-round-1',
      answers: { q1_constraints: { kind: 'multi', values: ['harvest'] } },
    });
    const settled = settleDraft(saved, pilot);
    expect(settled.roundId).toBe('2026-pilot');
    expect(settled.roundConfirmed).toBe(true);
    expect(settled.answers.q1_constraints).toEqual({ kind: 'multi', values: ['harvest'] });
    expect(settled.stepIndex).toBe(3);
    expect(settled.responseId).toBe('response');
  });

  it('confirms a draft already on the live round, and changes nothing else', () => {
    const saved = draft({ roundId: '2026-pilot', answers: { q4_bad_season: { kind: 'text', value: 'Wet harvest' } } });
    const settled = settleDraft(saved, pilot);
    expect(settled).toEqual({ ...saved, roundConfirmed: true });
  });

  it('starts clean when the round the draft belonged to has since closed', () => {
    const fromPilot = draft({ roundId: '2026-pilot', roundConfirmed: true, answers: { q4_bad_season: { kind: 'text', value: 'x' } } });
    const baseline = applyRound(q, { roundId: '2026-10-01-baseline', label: 'Baseline', stage: 'baseline', overrides: {} });
    const settled = settleDraft(fromPilot, baseline);
    expect(settled.roundId).toBe('2026-10-01-baseline');
    expect(settled.answers).toEqual({});
    expect(settled.responseId).not.toBe('response');
  });
});

describe('keepAsked', () => {
  it('drops answers to questions the live round does not ask, and keeps notes that are not questions', () => {
    const interim = applyRound(q, {
      roundId: 'check',
      label: 'Interim',
      stage: 'interim',
      overrides: { farm_practices: { inInterim: true } },
    });
    const kept = keepAsked(interim, {
      q1_constraints: { kind: 'multi', values: ['harvest'] },
      farm_practices: { kind: 'rating', values: { guidance: 4 } },
      interview__note__general: { kind: 'text', value: 'Keen to host' },
    });
    expect(Object.keys(kept).sort()).toEqual(['farm_practices', 'interview__note__general']);
  });
});
