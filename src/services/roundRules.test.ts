import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { questionById } from '../content/lookup';
import { LINK_CODE_ID } from './linkCode';
import {
  applyRound,
  everyRow,
  newRowId,
  newRowSchema,
  nextRoundOverrides,
  reportingFrame,
  roundProblems,
  type RoundDefinition,
} from './roundRules';
import type { ConsultationResponse, Question } from '../types';

const q = DEFAULT_QUESTIONNAIRE;
const SORTING = { id: 'harvester_sorting', label: 'Camera sorting on the harvester' };

const round = (
  stage: RoundDefinition['stage'],
  overrides: RoundDefinition['overrides'],
  roundId: string = stage,
): RoundDefinition => ({
  roundId,
  label: roundId,
  stage,
  overrides,
});

const rowIds = (question: Question | undefined): readonly string[] =>
  question?.kind === 'rating' ? question.rows.map((row) => row.id) : [];

const farmRows = rowIds(questionById(q, 'farm_practices'));

describe('watch lists', () => {
  it('take a new row in a later round, while the question itself stays word for word', () => {
    const later = applyRound(
      q,
      round('review', { farm_practices: { addedOptions: [SORTING], prompt: 'Something else entirely' } }),
    );
    const question = questionById(later, 'farm_practices');
    expect(rowIds(question)).toEqual([...farmRows, 'harvester_sorting']);
    expect(question?.prompt).toBe(questionById(q, 'farm_practices')?.prompt);
  });

  it('never let an added row redefine one that is already there', () => {
    const later = applyRound(
      q,
      round('review', { farm_practices: { addedOptions: [{ id: 'guidance', label: 'Something new' }] } }),
    );
    const question = questionById(later, 'farm_practices');
    expect(rowIds(question)).toEqual(farmRows);
    expect(question?.kind === 'rating' && question.rows[0]?.label).toBe('GPS guidance or autosteer');
  });

  it('can stop asking a row, without touching the questionnaire every round starts from', () => {
    const later = applyRound(q, round('review', { farm_practices: { retiredOptions: ['optical_grading'] } }));
    expect(rowIds(questionById(later, 'farm_practices'))).not.toContain('optical_grading');
    expect(rowIds(questionById(q, 'farm_practices'))).toContain('optical_grading');
  });

  it('are never left with nothing to answer', () => {
    const later = applyRound(q, round('review', { farm_practices: { retiredOptions: farmRows } }));
    expect(rowIds(questionById(later, 'farm_practices'))).toEqual(farmRows);
  });

  it('are the only tracked questions a round can add to', () => {
    // A tick list: a new option draws ticks away from the others.
    const tickList = applyRound(
      q,
      round('review', { q1_constraints: { addedOptions: [{ id: 'weather', label: 'Weather' }] } }),
    );
    expect(questionById(tickList, 'q1_constraints')).toEqual(questionById(q, 'q1_constraints'));
    // A rating that is not a watch list stays as it is too.
    const confidence = applyRound(
      q,
      round('review', { q_confidence: { addedOptions: [{ id: 'extra', label: 'Extra' }], retiredOptions: ['pays'] } }),
    );
    expect(questionById(confidence, 'q_confidence')).toEqual(questionById(q, 'q_confidence'));
  });
});

describe('interim checks', () => {
  const interim = applyRound(
    q,
    round('interim', {
      farm_practices: { inInterim: true, addedOptions: [SORTING], retiredOptions: farmRows },
    }),
  );

  it('ask only what the team ticked, and the follow-up code', () => {
    const asked = [
      ...interim.core,
      ...Object.values(interim.pathways),
      ...interim.followUp,
      ...interim.projectDesign,
    ].flatMap((section) => section.questions.map((question) => question.id));
    expect(asked.sort()).toEqual(['farm_practices', LINK_CODE_ID].sort());
  });

  it('can narrow a list to the new rows alone', () => {
    expect(rowIds(questionById(interim, 'farm_practices'))).toEqual(['harvester_sorting']);
  });

  it('leave no empty steps behind', () => {
    expect(interim.core).toEqual([]);
    expect(Object.keys(interim.pathways)).toEqual(['farm']);
  });

  it('leave tracked questions out only in an interim', () => {
    const review = applyRound(q, round('review', { q1_constraints: { inInterim: false } }));
    expect(questionById(review, 'q1_constraints')).toBeDefined();
  });
});

describe('nextRoundOverrides', () => {
  const baseline = round('baseline', { farm_practices: { retiredOptions: ['autonomy'] }, q4_bad_season: { prompt: 'Reworded' } });
  const interim = round('interim', {
    farm_practices: { inInterim: true, addedOptions: [SORTING], retiredOptions: farmRows },
  });

  it('carries on the last full round', () => {
    expect(nextRoundOverrides([baseline])).toEqual(baseline.overrides);
  });

  it('carries on a row an interim added, and nothing the interim left out', () => {
    const next = nextRoundOverrides([baseline, interim]);
    const practices = next.farm_practices;
    expect(practices?.addedOptions).toEqual([SORTING]);
    // The baseline stopped autonomy; the interim's narrowing does not carry on.
    expect(practices?.retiredOptions).toEqual(['autonomy']);
    expect(practices?.inInterim).toBeUndefined();
    expect(next.q4_bad_season?.prompt).toBe('Reworded');
  });

  it('asks everything again at the review that follows an interim', () => {
    const review = applyRound(q, round('review', nextRoundOverrides([baseline, interim])));
    expect(rowIds(questionById(review, 'farm_practices'))).toEqual([
      ...farmRows.filter((id) => id !== 'autonomy'),
      'harvester_sorting',
    ]);
    expect(questionById(review, 'q1_constraints')).toBeDefined();
  });
});

describe('reportingFrame', () => {
  const response = (answers: ConsultationResponse['answers']): ConsultationResponse => ({
    id: crypto.randomUUID(),
    roundId: 'review',
    role: 'grower',
    pathway: 'farm',
    regions: [],
    regionOther: '',
    answers,
    startedAt: '2026-09-01T00:00:00.000Z',
    submittedAt: '2026-09-01T00:10:00.000Z',
    durationSeconds: 600,
    isTestData: false,
    method: 'online',
    collectedBy: null,
    consentVerbal: null,
    sessionId: null,
    source: null,
  });

  it('keeps every row any round asked, stopped or not', () => {
    const frame = reportingFrame(
      q,
      [
        round('baseline', {}),
        round('interim', { farm_practices: { inInterim: true, addedOptions: [SORTING], retiredOptions: farmRows } }),
        round('review', { farm_practices: { addedOptions: [SORTING], retiredOptions: ['optical_grading'] } }),
      ],
      'review',
    );
    expect(rowIds(questionById(frame, 'farm_practices'))).toEqual([...farmRows, 'harvester_sorting']);
  });

  it('keeps a question the round collecting now has retired, so its answers still export', () => {
    const frame = reportingFrame(q, [round('review', { q4_bad_season: { retired: true } })], 'review');
    expect(questionById(frame, 'q4_bad_season')).toBeDefined();
  });

  it('shows a row an answer points at, even when no round defines it any more', () => {
    const frame = reportingFrame(q, [round('review', {})], 'review', [
      response({ farm_practices: { kind: 'rating', values: { harvest_damage: 3 } } }),
    ]);
    const question = questionById(frame, 'farm_practices');
    expect(rowIds(question)).toContain('harvest_damage');
  });

  it('words things the way the round collecting now words them', () => {
    const frame = reportingFrame(
      q,
      [round('baseline', { q4_bad_season: { prompt: 'Old words' } }, 'a'), round('review', { q4_bad_season: { prompt: 'New words' } }, 'b')],
      'b',
    );
    expect(questionById(frame, 'q4_bad_season')?.prompt).toBe('New words');
  });
});

describe('newRowId', () => {
  it('is readable, and never one already taken', () => {
    expect(newRowId('Camera sorting on the harvester', new Set())).toBe('camera_sorting_on_the_harvester');
    expect(newRowId('Weeding robot', new Set(['weeding_robot']))).toBe('weeding_robot_2');
  });

  it('never takes the id reserved for the row people name themselves', () => {
    expect(newRowId('Other', new Set())).toBe('other_2');
  });
});

describe('newRowSchema', () => {
  it('trims what was typed, and refuses a line too short or too long to read', () => {
    expect(newRowSchema.parse({ label: '  Weeding robot  ', help: '' }).label).toBe('Weeding robot');
    expect(newRowSchema.safeParse({ label: 'ab', help: '' }).success).toBe(false);
    expect(newRowSchema.safeParse({ label: 'x'.repeat(121), help: '' }).success).toBe(false);
  });
});

describe('follow-up questions', () => {
  it('are left out of a round that is not a follow-up, so every screen agrees on what it asked', () => {
    expect(applyRound(q, round('baseline', {})).followUp).toEqual([]);
    expect(applyRound(q, round('pilot', {})).followUp).toEqual([]);
    expect(applyRound(q, round('review', {})).followUp.length).toBeGreaterThan(0);
  });
});

describe('roundProblems', () => {
  const others = [round('baseline', {}, 'the-baseline')];

  it('refuses an interim that would ask nothing but the follow-up code', () => {
    expect(roundProblems(q, round('interim', {}, 'check'), { others })).toHaveLength(1);
    expect(roundProblems(q, round('interim', { farm_practices: { inInterim: true } }, 'check'), { others })).toEqual([]);
  });

  it('refuses a second starting point', () => {
    expect(roundProblems(q, round('baseline', {}, 'another'), { others })[0]).toContain('already a starting point');
  });

  it('refuses a short code another round already has', () => {
    expect(roundProblems(q, round('review', {}, 'the-baseline'), { others })[0]).toContain('already belongs');
  });

  it('refuses to change the kind of a round that already has responses', () => {
    const problems = roundProblems(q, round('interim', { farm_practices: { inInterim: true } }, 'live'), {
      others,
      savedStage: 'review',
      responses: 3,
    });
    expect(problems.some((problem) => problem.includes('cannot change'))).toBe(true);
  });

  it('passes an ordinary follow-up', () => {
    expect(roundProblems(q, round('review', {}, 'mid'), { others })).toEqual([]);
  });
});

describe('ids read back from storage', () => {
  it('never lets a new row take a name every object already has', () => {
    expect(newRowId('Constructor', new Set())).toBe('constructor_2');
  });

  it('never turns an unsafe answer key into a report row', () => {
    const question = questionById(q, 'farm_practices');
    if (question?.kind !== 'rating') throw new Error('expected a rating question');
    const crafted = {
      id: crypto.randomUUID(),
      roundId: 'review',
      role: 'grower' as const,
      pathway: 'farm',
      regions: [],
      regionOther: '',
      answers: { farm_practices: { kind: 'rating' as const, values: { constructor: 3, ['__proto__']: 2, weeding_robot: 4 } } },
      startedAt: '2026-09-01T00:00:00.000Z',
      submittedAt: '2026-09-01T00:10:00.000Z',
      durationSeconds: 600,
      isTestData: false,
      method: 'online' as const,
      collectedBy: null,
      consentVerbal: null,
      sessionId: null,
      source: null,
    };
    const rows = everyRow(question, [], [crafted]).map((row) => row.id);
    expect(rows).toContain('weeding_robot');
    expect(rows).not.toContain('constructor');
    expect(rows).not.toContain('__proto__');
  });
});

describe('reportingFrame completeness', () => {
  it('keeps every question even while an interim that asks one list is collecting', () => {
    const interim = round('interim', { farm_practices: { inInterim: true } }, 'check');
    const frame = reportingFrame(q, [interim], 'check');
    expect(questionById(frame, 'q1_constraints')).toBeDefined();
    expect(questionById(frame, 'q5_areas')).toBeDefined();
  });

  it('keeps answers to a question no questionnaire defines any more', () => {
    const answered = {
      id: crypto.randomUUID(),
      roundId: '2026-pilot',
      role: 'grower' as const,
      pathway: 'farm',
      regions: [],
      regionOther: '',
      answers: { farm_adopted: { kind: 'multi' as const, values: ['guidance'], other: 'Drone mapping' } },
      startedAt: '2026-09-01T00:00:00.000Z',
      submittedAt: '2026-09-01T00:10:00.000Z',
      durationSeconds: 600,
      isTestData: false,
      method: 'online' as const,
      collectedBy: null,
      consentVerbal: null,
      sessionId: null,
      source: null,
    };
    const frame = reportingFrame(q, [], null, [answered]);
    const retired = questionById(frame, 'farm_adopted');
    expect(retired?.prompt).toContain('no longer asked');
    expect(retired?.kind === 'multi' && retired.allowOther).toBe(true);
  });
});
