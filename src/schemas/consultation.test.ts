import { describe, expect, it } from 'vitest';
import { consultationResponseSchema } from './consultation';
import type { ConsultationResponse } from '../types';

const base: ConsultationResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  roundId: '2026-pilot',
  role: 'grower',
  pathway: 'farm',
  regions: [],
  regionOther: '',
  answers: {},
  startedAt: '2026-09-17T00:00:00.000Z',
  submittedAt: '2026-09-17T00:10:00.000Z',
  durationSeconds: 600,
  isTestData: false,
  method: 'online',
  collectedBy: null,
  consentVerbal: null,
  sessionId: null,
};

const STAFF = '22222222-2222-4222-8222-222222222222';

describe('consultationResponseSchema', () => {
  it('accepts an online response with no interviewer', () => {
    expect(consultationResponseSchema.safeParse(base).success).toBe(true);
  });

  it('refuses an interview without spoken consent', () => {
    const result = consultationResponseSchema.safeParse({ ...base, method: 'interview_phone', collectedBy: STAFF });
    expect(result.success).toBe(false);
  });

  it('refuses an interview with no interviewer recorded', () => {
    const result = consultationResponseSchema.safeParse({ ...base, method: 'interview_phone', consentVerbal: true });
    expect(result.success).toBe(false);
  });

  it('accepts an interview with consent and an interviewer', () => {
    const result = consultationResponseSchema.safeParse({
      ...base,
      method: 'interview_in_person',
      consentVerbal: true,
      collectedBy: STAFF,
    });
    expect(result.success).toBe(true);
  });

  it('refuses an item marked prompted that was never mentioned', () => {
    const result = consultationResponseSchema.safeParse({
      ...base,
      answers: { q1_constraints: { kind: 'multi', values: ['harvest'], prompted: ['skills'] } },
    });
    expect(result.success).toBe(false);
  });
});
