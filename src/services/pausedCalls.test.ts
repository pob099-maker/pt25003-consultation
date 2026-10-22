import { describe, expect, it } from 'vitest';
import type { Draft } from '../hooks/useConsultation';
import { minutesText, resumedDraft, stillOpen, talkingSeconds, waitingText, type PausedCall } from './pausedCalls';

const draft: Draft = {
  progressId: crypto.randomUUID(),
  responseId: crypto.randomUUID(),
  startedAt: '2026-10-20T09:00:00.000Z',
  roundId: '2026-round-1',
  roundConfirmed: true,
  role: 'grower',
  regions: ['ballarat'],
  regionOther: '',
  answers: { sector: { kind: 'multi', values: ['grow'] } },
  stepIndex: 2,
  stepId: 'core_constraints',
  length: null,
};

const call = (overrides: Partial<PausedCall> = {}): PausedCall => ({
  id: draft.responseId,
  staffId: '00000000-0000-4000-a000-000000000001',
  setup: { method: 'interview_phone', consent: true, length: 'short' },
  draft,
  note: 'Thorpdale, after milking, ask for the manager',
  ringBack: 'days',
  pausedAt: '2026-10-20T09:04:00.000Z',
  activeSeconds: 240,
  stepTitle: 'Current challenges',
  stepNumber: 3,
  stepCount: 6,
  ...overrides,
});

describe('a paused call', () => {
  it('counts only the talking time, however long it waited', () => {
    expect(talkingSeconds(draft, new Date('2026-10-20T09:04:00.000Z'))).toBe(240);
    const picked = resumedDraft(call(), new Date('2026-10-23T14:00:00.000Z'));
    // Moved up so that finishing ten minutes later records fourteen, not three days.
    expect(talkingSeconds(picked, new Date('2026-10-23T14:10:00.000Z'))).toBe(840);
    expect(picked.answers).toEqual(draft.answers);
    expect(picked.responseId).toBe(draft.responseId);
    expect(picked.stepId).toBe('core_constraints');
  });

  it('never claims a call longer than a response may be', () => {
    expect(talkingSeconds(draft, new Date('2026-10-29T09:00:00.000Z'))).toBe(60 * 60 * 24);
  });

  it('cannot be finished in a round that has closed since', () => {
    expect(stillOpen(call(), '2026-round-1', true)).toBe(true);
    expect(stillOpen(call(), '2027-review', true)).toBe(false);
    // Offline, the round cannot be checked, so it is offered.
    expect(stillOpen(call(), '2027-review', false)).toBe(true);
  });

  it('says how long it has waited, and when to ring', () => {
    const now = new Date('2026-10-21T12:00:00.000Z');
    expect(waitingText(call({ ringBack: 'tomorrow' }), now)).toBe('Paused yesterday · ring back now');
    expect(waitingText(call({ ringBack: 'week' }), now)).toBe('Paused yesterday · ring back in 6 days');
    expect(minutesText(240)).toBe('4 min so far');
  });
});
