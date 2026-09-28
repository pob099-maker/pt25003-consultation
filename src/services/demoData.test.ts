import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { consultationResponseSchema } from '../schemas/consultation';
import { compareRounds } from './change';
import { DEMO_BASELINE, DEMO_INTERIM, DEMO_NEW_ROW, DEMO_REVIEW, DEMO_ROUNDS, demoResponses } from './demoData';

const q = DEFAULT_QUESTIONNAIRE;
const responses = demoResponses(q);

describe('demoResponses', () => {
  it('gives a baseline of 45, an interim check of 20 and a review of 38', () => {
    expect(responses.filter((response) => response.roundId === DEMO_BASELINE)).toHaveLength(45);
    expect(responses.filter((response) => response.roundId === DEMO_INTERIM)).toHaveLength(20);
    expect(responses.filter((response) => response.roundId === DEMO_REVIEW)).toHaveLength(38);
  });

  it('asks the interim check about the new line alone', () => {
    const interim = responses.filter((response) => response.roundId === DEMO_INTERIM);
    const rated = interim.flatMap((response) => {
      const answer = response.answers.farm_practices;
      return answer?.kind === 'rating' ? Object.keys(answer.values) : [];
    });
    expect(rated.length).toBeGreaterThan(0);
    expect(rated.every((id) => id === DEMO_NEW_ROW.id || id === 'other')).toBe(true);
  });

  it('compares the line taken on part-way through from the interim check', () => {
    const comparison = compareRounds(q, responses, DEMO_ROUNDS);
    const row = comparison.blocks
      .find((block) => block.questionId === 'farm_practices')
      ?.rows.find((candidate) => candidate.id === DEMO_NEW_ROW.id);
    expect(row?.asked).toEqual([false, true, true]);
    expect(row?.from).toBe(1);
    expect(row?.change).not.toBeNull();
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
