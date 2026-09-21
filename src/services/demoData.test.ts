import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { consultationResponseSchema } from '../schemas/consultation';
import { compareRounds } from './change';
import { DEMO_BASELINE, DEMO_REVIEW, DEMO_ROUNDS, demoResponses } from './demoData';

const q = DEFAULT_QUESTIONNAIRE;
const responses = demoResponses(q);

describe('demoResponses', () => {
  it('gives a baseline of 45 and a review of 38', () => {
    expect(responses.filter((response) => response.roundId === DEMO_BASELINE)).toHaveLength(45);
    expect(responses.filter((response) => response.roundId === DEMO_REVIEW)).toHaveLength(38);
  });

  it('is the same every time it is opened', () => {
    expect(demoResponses(q)).toEqual(
      responses.map((response) => ({ ...response, startedAt: expect.any(String), submittedAt: expect.any(String) })),
    );
  });

  it('passes the same validation as a real response', () => {
    for (const response of responses) {
      const parsed = consultationResponseSchema.safeParse(response);
      expect(parsed.success, `${response.id}: ${parsed.success ? '' : parsed.error.issues[0]?.message}`).toBe(true);
    }
  });

  it('shows every way of taking part', () => {
    const methods = new Set(responses.map((response) => response.method));
    expect(methods).toEqual(new Set(['online', 'interview_phone', 'interview_in_person', 'workshop']));
  });

  it('has a change for the change-over-time view to show', () => {
    const comparison = compareRounds(q, responses, DEMO_ROUNDS);
    expect(comparison.hasBaseline).toBe(true);
    expect(comparison.hasReview).toBe(true);
    const moved = comparison.blocks.flatMap((block) => block.rows).filter((row) => Math.abs(row.change ?? 0) >= 0.1);
    expect(moved.length).toBeGreaterThan(0);
  });
});
