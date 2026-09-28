import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { compareRounds, type RoundInfo } from './change';
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

const evidence = (values: string[]): AnswerMap => ({ q7_evidence: { kind: 'multi', values, other: '' } });

describe('compareRounds', () => {
  it('leaves the pilot out entirely — it was the team testing the form', () => {
    const result = compareRounds(q, [response('pilot', evidence(['local_demo']))], rounds);
    expect(result.columns.map((column) => column.roundId)).toEqual(['base', 'mid']);
  });

  it('measures a tick as a share of the people who answered, and reports the change', () => {
    const result = compareRounds(
      q,
      [
        response('base', evidence(['local_demo'])),
        response('base', evidence(['roi'])),
        response('base', evidence(['local_demo', 'case_study'])),
        response('base', evidence(['peer'])),
        response('mid', evidence(['case_study'])),
        response('mid', evidence(['case_study', 'local_demo'])),
      ],
      rounds,
    );
    const block = result.blocks.find((b) => b.questionId === 'q7_evidence');
    const caseStudy = block?.rows.find((row) => row.id === 'case_study');
    expect(block?.answered).toEqual([4, 2]);
    expect(caseStudy?.values).toEqual([0.25, 1]);
    expect(caseStudy?.change).toBe(0.75);
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
    const onlyBaseline = compareRounds(q, [response('base', evidence(['local_demo']))], [rounds[1] as RoundInfo]);
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
