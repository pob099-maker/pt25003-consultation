import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { applyRound } from '../services/roundRules';
import { shortVersion } from '../services/formLength';
import type { Questionnaire } from '../types';
import { keepAsked, resumableDraft, resumeStep, settleDraft, type Draft, type Step } from './useConsultation';

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
  stepId: null,
  length: null,
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

/** The steps a grower is shown, in the order the form shows them. */
const stepsOf = (questionnaire: Questionnaire): Step[] => [
  { id: 'about_you', title: 'About your perspective', section: null },
  ...[...questionnaire.core, ...Object.values(questionnaire.pathways).slice(0, 1), ...questionnaire.projectDesign].map(
    (section) => ({ id: section.id, title: section.title, section }),
  ),
  { id: 'stay_involved', title: 'Stay involved', section: null },
];

describe('resumeStep', () => {
  const full = stepsOf(q);
  const short = stepsOf(shortVersion(q));

  it('finds the same step in the other version, where the same number points somewhere else', () => {
    // The fault this replaced: a place saved as "step 5" of the full version
    // opened a different section, or the last page, of the short one.
    const moved = short.find((step, index) => full.findIndex((candidate) => candidate.id === step.id) !== index);
    expect(moved).toBeDefined();
    const inFull = full.findIndex((step) => step.id === moved?.id);
    expect(resumeStep(short, { stepId: moved?.id ?? null, stepIndex: inFull })).toBe(
      short.findIndex((step) => step.id === moved?.id),
    );
  });

  it('goes on to the step that follows when this version does not have the one it was on', () => {
    const fullOnly = full.findIndex((step) => !short.some((candidate) => candidate.id === step.id));
    expect(fullOnly).toBeGreaterThan(0);
    const follows = full.slice(fullOnly).find((step) => short.some((candidate) => candidate.id === step.id));
    const at = resumeStep(short, { stepId: full[fullOnly]?.id ?? null, stepIndex: fullOnly });
    expect(short[at]?.id).toBe(follows?.id);
  });

  it('uses the number in a draft saved before steps had ids, never past the end', () => {
    expect(resumeStep(short, { stepId: null, stepIndex: 2 })).toBe(2);
    expect(resumeStep(short, { stepId: null, stepIndex: 99 })).toBe(short.length - 1);
  });
});

describe('resumableDraft', () => {
  const opened = draft({ role: null, stepIndex: 0, stepId: 'about_you', roundId: '2026-pilot', roundConfirmed: true });

  it('does not count a form that was only opened as saved answers', () => {
    expect(resumableDraft(opened, '2026-pilot', true)).toBeNull();
    expect(resumableDraft(null, '2026-pilot', true)).toBeNull();
  });

  it('offers one with anything in it, and remembers which version it was in', () => {
    const started = resumableDraft({ ...opened, role: 'grower', length: 'short' }, '2026-pilot', true);
    expect(started?.role).toBe('grower');
    expect(started?.length).toBe('short');
  });

  it('leaves out a draft from a round that has closed, which the form would clear anyway', () => {
    const fromPilot = { ...opened, role: 'grower' as const };
    expect(resumableDraft(fromPilot, '2026-10-01-baseline', true)).toBeNull();
    // Until the server has answered, which round is live is not known.
    expect(resumableDraft(fromPilot, '2026-10-01-baseline', false)).not.toBeNull();
    // A draft begun on a stand-in takes the live round rather than being dropped.
    expect(resumableDraft({ ...fromPilot, roundConfirmed: false }, '2026-10-01-baseline', true)).not.toBeNull();
  });
});
