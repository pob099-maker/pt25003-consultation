import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { seedResponses } from './seed';
import { freeTextEntries, overview, rankConstraints, rateAreas, tallyMulti } from './analysis';
import type { ConsultationResponse } from '../types';

const q = DEFAULT_QUESTIONNAIRE;
const responses = seedResponses();

const bare = (answers: ConsultationResponse['answers']): ConsultationResponse => ({
  id: crypto.randomUUID(),
  roundId: q.roundId,
  role: 'grower',
  pathway: 'farm',
  regions: [],
  regionOther: '',
  answers,
  startedAt: '2026-09-01T00:00:00.000Z',
  submittedAt: '2026-09-01T00:10:00.000Z',
  durationSeconds: 600,
  isTestData: true,
  method: 'online',
  collectedBy: null,
  consentVerbal: null,
  sessionId: null,
  source: null,
});

describe('rankConstraints', () => {
  it('weights a first choice above a third', () => {
    const ranked = rankConstraints(
      q,
      [
        bare({ q2_top_three: { kind: 'rank', values: ['harvesting', 'skills', 'data'] } }),
        bare({ q2_top_three: { kind: 'rank', values: ['skills', 'data', 'harvesting'] } }),
      ],
      'q2_top_three',
    );
    expect(ranked[0]?.id).toBe('skills');
    expect(ranked.find((row) => row.id === 'skills')?.weightedScore).toBe(5);
    expect(ranked.find((row) => row.id === 'harvesting')?.weightedScore).toBe(4);
  });

  it('reports labels rather than stored ids', () => {
    const ranked = rankConstraints(q, [...responses], 'q2_top_three');
    expect(ranked[0]?.label).not.toBe(ranked[0]?.id);
  });

  it('ignores responses that skipped the ranking', () => {
    expect(rankConstraints(q, [bare({})], 'q2_top_three')).toHaveLength(0);
  });
});

describe('rateAreas', () => {
  it('averages only the ratings actually given', () => {
    const rated = rateAreas(
      q,
      [
        bare({ q5_areas: { kind: 'rating', values: { training: 5 } } }),
        bare({ q5_areas: { kind: 'rating', values: { training: 3 } } }),
        // An unrated area must not be counted as a zero: a question nobody
        // answered is not the same as one everybody called unimportant.
        bare({ q5_areas: { kind: 'rating', values: { robotics: 1 } } }),
      ],
      'q5_areas',
    );
    const training = rated.find((row) => row.id === 'training');
    expect(training?.mean).toBe(4);
    expect(training?.responses).toBe(2);
  });
});

describe('overview', () => {
  it('counts a response as complete once it answered something in the final section', () => {
    const stats = overview(q, [
      bare({ pd_most_useful: { kind: 'text', value: 'Field days.' } }),
      bare({ q6_first_opportunities: { kind: 'text', value: 'Late harvest.' } }),
    ]);
    expect(stats.total).toBe(2);
    expect(stats.completionRate).toBe(0.5);
  });

  it('summarises the seeded test data', () => {
    const stats = overview(q, [...responses]);
    expect(stats.total).toBe(8);
    expect(stats.completionRate).toBe(1);
    expect(stats.medianMinutes).toBeGreaterThan(5);
  });
});

describe('tallyMulti and freeTextEntries', () => {
  it('counts each selected option once per response', () => {
    const tally = tallyMulti(q, [...responses], 'q1_constraints');
    const total = tally.reduce((sum, row) => sum + row.count, 0);
    expect(total).toBeGreaterThan(responses.length);
    expect(tally.every((row) => row.count <= responses.length)).toBe(true);
  });

  it('skips blank free text', () => {
    const entries = freeTextEntries(q, [bare({ q6_first_opportunities: { kind: 'text', value: '   ' } })]);
    expect(entries).toHaveLength(0);
  });
});

describe('something else on a practice list', () => {
  it('is read with the comments, along with the step they gave it', () => {
    const entries = freeTextEntries(q, [
      bare({ farm_practices: { kind: 'rating', values: { guidance: 4, other: 3 }, other: 'Weeding robot' } }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.text).toBe('Weeding robot (Trying it)');
    expect(entries[0]?.questionPrompt).toContain('Something else');
  });
});

describe("a question's own box", () => {
  it('is read with the comments, with the choice it belongs to', () => {
    const entries = freeTextEntries(q, [
      bare({
        q3_impact: { kind: 'multi', values: ['timeliness'], other: '', note: 'Wet harvest, two paddocks late' },
        farm_outcome: { kind: 'single', value: 'stopped', note: 'Drone scouting' },
      }),
    ]);
    expect(entries.map((entry) => entry.text).sort()).toEqual([
      'Drone scouting (We tried it and stopped)',
      'Wet harvest, two paddocks late',
    ]);
    expect(entries.find((entry) => entry.questionId === 'q3_impact')?.questionPrompt).toContain(
      'give an example from a tough season',
    );
  });
});

describe('tried it and stopped', () => {
  it('is counted beside the steps, and never averaged with them', () => {
    const rows = rateAreas(
      q,
      [
        bare({ farm_practices: { kind: 'rating', values: { guidance: 6 } } }),
        bare({ farm_practices: { kind: 'rating', values: { guidance: 4 } } }),
      ],
      'farm_practices',
    );
    const guidance = rows.find((row) => row.id === 'guidance');
    expect(guidance?.mean).toBe(4);
    expect(guidance?.responses).toBe(1);
    expect(guidance?.scores).toHaveLength(5);
    expect(guidance?.outside).toEqual([{ label: 'Tried it and stopped', count: 1 }]);
  });
});

describe('completion', () => {
  it('counts only full-version answers, and not the follow-up code alone', () => {
    const short = bare({ interview__length: { kind: 'single', value: 'short' }, link_code: { kind: 'text', value: 'JO14BA' } });
    const fullFinished = bare({ pd_most_useful: { kind: 'text', value: 'Field days' } });
    const fullCodeOnly = bare({ link_code: { kind: 'text', value: 'JO14BA' } });
    expect(overview(q, [short, fullFinished, fullCodeOnly]).completionRate).toBe(0.5);
  });
});
