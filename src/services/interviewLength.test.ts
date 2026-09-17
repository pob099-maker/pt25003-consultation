import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { allQuestions, trackingQuestions } from '../content/lookup';
import { consultationResponseSchema } from '../schemas/consultation';
import { responseRow } from './exportCsv';
import { LENGTH_ID, lengthAnswer, lengthOf, shortInterview } from './interviewLength';

const q = DEFAULT_QUESTIONNAIRE;
const short = shortInterview(q);

describe('shortInterview', () => {
  it('keeps every tracked question and nothing else', () => {
    const kept = allQuestions(short).map((question) => question.id);
    expect(kept.sort()).toEqual(trackingQuestions(q).map((question) => question.id).sort());
  });

  it('drops sections with nothing left to ask', () => {
    expect([...short.core, ...short.projectDesign].every((section) => section.questions.length > 0)).toBe(true);
    expect(Object.values(short.pathways).every((section) => section.questions.length > 0)).toBe(true);
  });

  it('keeps the round, so a call can switch length and keep its draft', () => {
    expect(short.roundId).toBe(q.roundId);
    expect(short.roles).toBe(q.roles);
  });

  it('is short enough for a five-minute call', () => {
    const farm = [...short.core, short.pathways.farm].flatMap((section) => section?.questions ?? []);
    expect(farm.length).toBeLessThanOrEqual(10);
  });
});

describe('recording the length', () => {
  it('reads back what was recorded, and nothing for an older response', () => {
    expect(lengthOf({ [LENGTH_ID]: lengthAnswer('short') })).toBe('short');
    expect(lengthOf({})).toBeNull();
  });

  it('is exported, and passes validation', () => {
    const response = {
      id: crypto.randomUUID(),
      roundId: q.roundId,
      role: 'grower' as const,
      pathway: 'farm',
      regions: [],
      regionOther: '',
      answers: { [LENGTH_ID]: lengthAnswer('short') },
      startedAt: '2026-10-01T00:00:00.000Z',
      submittedAt: '2026-10-01T00:05:00.000Z',
      durationSeconds: 300,
      isTestData: false,
      method: 'interview_phone' as const,
      collectedBy: '22222222-2222-4222-8222-222222222222',
      consentVerbal: true,
      sessionId: null,
    };
    expect(consultationResponseSchema.safeParse(response).success).toBe(true);
    expect(responseRow(q, response).interview_length).toBe('short');
  });
});
