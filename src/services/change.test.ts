import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { chartInput, compareRounds, rowHistory, type RoundInfo } from './change';
import { questionById } from '../content/lookup';
import type { AnswerMap, ConsultationResponse } from '../types';

const q = DEFAULT_QUESTIONNAIRE;

const response = (roundId: string, answers: AnswerMap, role: ConsultationResponse['role'] = 'grower'): ConsultationResponse => ({
  id: crypto.randomUUID(),
  roundId,
  role,
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

const rounds: readonly RoundInfo[] = [
  { roundId: 'pilot', label: 'Pilot', stage: 'pilot' },
  { roundId: 'base', label: 'Baseline', stage: 'baseline' },
  { roundId: 'mid', label: 'Mid-project', stage: 'review' },
];

const trusted = (values: string[]): AnswerMap => ({ q_trust: { kind: 'multi', values, other: '' } });

describe('compareRounds', () => {
  it('leaves the pilot out entirely — it was the team testing the form', () => {
    const result = compareRounds(q, [response('pilot', trusted(['neighbours']))], rounds);
    expect(result.columns.map((column) => column.roundId)).toEqual(['base', 'mid']);
  });

  it('measures a tick as a share of the people who answered, and reports the change', () => {
    const result = compareRounds(
      q,
      [
        response('base', trusted(['neighbours'])),
        response('base', trusted(['agronomist'])),
        response('base', trusted(['neighbours', 'dealer'])),
        response('base', trusted(['field_days'])),
        response('mid', trusted(['dealer'])),
        response('mid', trusted(['dealer', 'neighbours'])),
      ],
      rounds,
    );
    const block = result.blocks.find((b) => b.questionId === 'q_trust');
    const dealer = block?.rows.find((row) => row.id === 'dealer');
    expect(block?.answered).toEqual([4, 2]);
    expect(dealer?.values).toEqual([0.25, 1]);
    expect(dealer?.change).toBe(0.75);
  });

  it('averages ratings per area, counting only the areas people actually rated', () => {
    const result = compareRounds(
      q,
      [
        response('base', { q5_areas: { kind: 'rating', values: { optical_sorting: 2 } } }),
        response('base', { q5_areas: { kind: 'rating', values: { optical_sorting: 4, training: 5 } } }),
        response('mid', { q5_areas: { kind: 'rating', values: { optical_sorting: 5 } } }),
      ],
      rounds,
    );
    const block = result.blocks.find((b) => b.questionId === 'q5_areas');
    expect(block?.measure).toBe('mean');
    expect(block?.rows.find((row) => row.id === 'optical_sorting')?.values).toEqual([3, 5]);
    expect(block?.rows.find((row) => row.id === 'optical_sorting')?.change).toBe(2);
    // Nobody rated training in the review, which is not the same as rating it zero.
    expect(block?.rows.find((row) => row.id === 'training')?.values).toEqual([5, null]);
    expect(block?.rows.find((row) => row.id === 'training')?.change).toBeNull();
  });

  it('reports no change until there is both a baseline and a review', () => {
    const onlyBaseline = compareRounds(q, [response('base', trusted(['neighbours']))], [rounds[1] as RoundInfo]);
    expect(onlyBaseline.hasReview).toBe(false);
    for (const block of onlyBaseline.blocks) {
      for (const row of block.rows) expect(row.change).toBeNull();
    }
  });

  it('shows who answered each round, so a different mix is not read as a change of mind', () => {
    const result = compareRounds(
      q,
      [response('base', {}, 'grower'), response('base', {}, 'grower'), response('mid', {}, 'processor')],
      rounds,
    );
    expect(result.composition.find((row) => row.role === 'grower')?.counts).toEqual([2, 0]);
    expect(result.composition.find((row) => row.role === 'processor')?.counts).toEqual([0, 1]);
  });
});

describe('rows that come and go', () => {
  const SORTING = { id: 'harvester_sorting', label: 'Camera sorting on the harvester' };
  const practicesQuestion = questionById(q, 'farm_practices');
  const farmRows = practicesQuestion?.kind === 'rating' ? practicesQuestion.rows.map((row) => row.id) : [];
  const phases: readonly RoundInfo[] = [
    { roundId: 'base', label: 'Baseline', stage: 'baseline', overrides: {} },
    {
      roundId: 'check',
      label: 'Interim check',
      stage: 'interim',
      overrides: { farm_practices: { inInterim: true, addedOptions: [SORTING], retiredOptions: farmRows } },
    },
    {
      roundId: 'mid',
      label: 'Mid-project',
      stage: 'review',
      overrides: { farm_practices: { addedOptions: [SORTING], retiredOptions: ['optical_grading'] } },
    },
  ];
  const practices = (values: Record<string, number>, other?: string): AnswerMap => ({
    farm_practices: { kind: 'rating', values, ...(other === undefined ? {} : { other }) },
  });

  const result = compareRounds(
    q,
    [
      response('base', practices({ guidance: 4, optical_grading: 2 })),
      response('base', practices({ guidance: 2, optical_grading: 4 })),
      response('check', practices({ harvester_sorting: 1 })),
      response('check', practices({ harvester_sorting: 2 })),
      response('mid', practices({ guidance: 5, harvester_sorting: 3, other: 3 }, 'Weeding robot')),
    ],
    phases,
  );
  const block = result.blocks.find((candidate) => candidate.questionId === 'farm_practices');
  const row = (id: string) => block?.rows.find((candidate) => candidate.id === id);

  it('compares a row first asked in an interim from the interim, and shows the baseline as not asked', () => {
    expect(row('harvester_sorting')?.asked).toEqual([false, true, true]);
    expect(row('harvester_sorting')?.values).toEqual([null, 1.5, 3]);
    expect(row('harvester_sorting')?.from).toBe(1);
    expect(row('harvester_sorting')?.change).toBe(1.5);
  });

  it('never lets an interim move a starting point that already exists', () => {
    expect(row('guidance')?.asked).toEqual([true, false, true]);
    expect(row('guidance')?.from).toBe(0);
    expect(row('guidance')?.change).toBe(2);
  });

  it('keeps the history of a row that stopped being asked, and reports no change it cannot measure', () => {
    expect(row('optical_grading')?.asked).toEqual([true, false, false]);
    expect(row('optical_grading')?.values).toEqual([3, null, null]);
    expect(row('optical_grading')?.change).toBeNull();
  });

  it('never compares the row somebody named themselves', () => {
    expect(row('other')).toBeUndefined();
  });

  it('says when a round did not ask a question at all', () => {
    const trust = result.blocks.find((candidate) => candidate.questionId === 'q_trust');
    expect(trust?.asked).toEqual([true, false, true]);
  });
});

describe('follow-up questions over the reviews', () => {
  const phases: readonly RoundInfo[] = [
    { roundId: 'base', label: 'Baseline', stage: 'baseline', overrides: {} },
    { roundId: 'mid', label: 'Mid-term', stage: 'review', overrides: {} },
    { roundId: 'final', label: 'Final', stage: 'review', overrides: {} },
  ];
  const changed = (value: string): AnswerMap => ({ fu_changed: { kind: 'single', value } });

  it('are compared from the first review, not from a starting point that never asked them', () => {
    const result = compareRounds(
      q,
      [
        response('mid', changed('changed')),
        response('mid', changed('no_change')),
        response('final', changed('changed')),
        response('final', changed('changed')),
      ],
      phases,
    );
    const block = result.blocks.find((candidate) => candidate.questionId === 'fu_changed');
    const row = block?.rows.find((candidate) => candidate.id === 'changed');
    expect(block?.asked).toEqual([false, true, true]);
    expect(row?.from).toBe(1);
    expect(row?.change).toBe(0.5);
  });
});

describe('answers a round already holds', () => {
  it('still count when the line is stopped while that round is collecting', () => {
    const phases: readonly RoundInfo[] = [
      { roundId: 'base', label: 'Baseline', stage: 'baseline', overrides: {} },
      { roundId: 'mid', label: 'Mid-term', stage: 'review', overrides: { farm_practices: { retiredOptions: ['guidance'] } } },
    ];
    const result = compareRounds(
      q,
      [
        response('base', { farm_practices: { kind: 'rating', values: { guidance: 2 } } }),
        response('mid', { farm_practices: { kind: 'rating', values: { guidance: 4 } } }),
      ],
      phases,
    );
    const row = result.blocks.find((b) => b.questionId === 'farm_practices')?.rows.find((r) => r.id === 'guidance');
    expect(row?.asked).toEqual([true, true]);
    expect(row?.change).toBe(2);
  });
});

describe('the follow-up code', () => {
  it('is never a block in the change view: it links people, it is not a measure', () => {
    const result = compareRounds(q, [], rounds);
    expect(result.blocks.some((block) => block.questionId === 'link_code')).toBe(false);
  });
});

describe('rowHistory and chartInput', () => {
  const columns = [
    { roundId: 'base', label: 'Baseline', stage: 'baseline' as const, respondents: 10 },
    { roundId: 'mid', label: 'Mid-term', stage: 'review' as const, respondents: 10 },
    { roundId: 'check', label: 'Interim check', stage: 'interim' as const, respondents: 5 },
  ];

  it('does not call a line stopped because the newest round is an interim that skipped it', () => {
    const row = { id: 'x', label: 'X', values: [2, 3, null], asked: [true, true, false], from: 0, to: 1, change: 1 };
    expect(rowHistory(row, columns)).toBeNull();
  });

  it('ends the chart line at the review the change is measured to', () => {
    const row = { id: 'x', label: 'X', values: [2, 2, 5], asked: [true, true, true], from: 0, to: 1, change: 0 };
    expect(chartInput([row])[0]?.values).toEqual([2, 2, null]);
  });
});
