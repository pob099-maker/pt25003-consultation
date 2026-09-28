import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsultationResponse, ContactRecord } from '../types';

// A stand-in database: each insert takes the next scripted reply.
const db = vi.hoisted(() => ({
  replies: [] as { error: { code?: string; message: string } | null }[],
  rows: [] as Record<string, unknown>[],
}));

vi.mock('../lib/supabase', () => ({
  getSupabase: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        db.rows.push(row);
        return Promise.resolve(db.replies.shift() ?? { error: null });
      },
    }),
  }),
}));

const { contactDay, outboxSize, submitConsultation, submitResponse } = await import('./submit');

const response = (over: Partial<ConsultationResponse> = {}): ConsultationResponse => ({
  id: '11111111-1111-4111-8111-111111111111',
  roundId: '2026-pilot',
  role: 'grower',
  pathway: 'farm',
  regions: [],
  regionOther: '',
  answers: {},
  startedAt: '2026-09-29T00:00:00.000Z',
  submittedAt: '2026-09-29T00:10:00.000Z',
  durationSeconds: 600,
  isTestData: false,
  method: 'online',
  collectedBy: null,
  consentVerbal: null,
  sessionId: null,
  source: 'mag22',
  ...over,
});

const contact = (over: Partial<ContactRecord> = {}): ContactRecord => ({
  id: '22222222-2222-4222-8222-222222222222',
  roundId: '2026-pilot',
  interests: ['summary'],
  name: 'Jane Citizen',
  organisation: '',
  broadRole: '',
  region: '',
  email: '',
  phone: '',
  preferredContactMethod: 'email',
  preferredContactTime: '',
  comments: '',
  submittedAt: contactDay(new Date('2026-09-29T07:50:41.684Z')),
  isTestData: false,
  source: null,
  ...over,
});

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  db.replies = [];
  db.rows = [];
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sending a response', () => {
  it('resends without the label only when the database has no label column yet', async () => {
    db.replies = [
      { error: { code: 'PGRST204', message: "Could not find the 'source' column of 'consultation_responses' in the schema cache" } },
      { error: null },
    ];
    const result = await submitResponse(response());
    expect(result).toEqual({ success: true, data: 'sent' });
    expect(db.rows).toHaveLength(2);
    expect('source' in (db.rows[1] ?? {})).toBe(false);
  });

  it('does not mistake a Firefox network error for a missing column', async () => {
    // "…when attempting to fetch resource." contains the word "source".
    db.replies = [{ error: { code: '', message: 'TypeError: NetworkError when attempting to fetch resource.' } }];
    const result = await submitResponse(response());
    expect(result).toEqual({ success: true, data: 'queued' });
    expect(db.rows).toHaveLength(1);
    expect(outboxSize()).toBe(1);
  });

  it('counts an id that is already stored as sent, so a lost reply never retries forever', async () => {
    db.replies = [{ error: { code: '23505', message: 'duplicate key value violates unique constraint' } }];
    expect(await submitResponse(response())).toEqual({ success: true, data: 'sent' });
    expect(outboxSize()).toBe(0);
  });

  it('keeps one copy of the same answers queued twice', async () => {
    db.replies = [
      { error: { code: '', message: 'TypeError: Failed to fetch' } },
      { error: { code: '', message: 'TypeError: Failed to fetch' } },
    ];
    await submitResponse(response());
    await submitResponse(response());
    expect(outboxSize()).toBe(1);
  });
});

describe('submitConsultation', () => {
  it('refuses contact details that reach nobody before the answers are sent', async () => {
    const result = await submitConsultation(response(), contact());
    expect(result.success).toBe(false);
    expect(db.rows).toHaveLength(0);
  });

  it('sends the answers, then the contact', async () => {
    const result = await submitConsultation(response(), contact({ email: 'jane@example.com' }));
    expect(result).toEqual({ success: true, data: { queued: false } });
    expect(db.rows).toHaveLength(2);
  });
});

describe('contactDay', () => {
  it('keeps the day and drops the time, so a contact cannot be matched to answers by the clock', () => {
    expect(contactDay(new Date('2026-09-29T07:50:41.684Z'))).toBe('2026-09-29T00:00:00.000Z');
  });
});
