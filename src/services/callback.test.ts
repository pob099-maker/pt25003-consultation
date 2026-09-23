import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { interestLabel } from '../content/lookup';
import { contactRecordSchema, callbackRequestSchema } from '../schemas/consultation';
import {
  ANY_TIME_ID,
  CALLBACK_INTEREST_ID,
  CALL_TIMES,
  callTimeSummary,
  isCallbackRequest,
  nextTimes,
  toCallbackRecord,
} from './callback';

const request = {
  name: 'Sam Ruddock',
  phone: '0400 000 111',
  times: ['evening', 'early'],
  note: 'On the harvester most of the day.',
};

describe('nextTimes', () => {
  it('adds and removes a window', () => {
    expect(nextTimes([], 'morning')).toEqual(['morning']);
    expect(nextTimes(['morning', 'evening'], 'morning')).toEqual(['evening']);
  });

  it('treats "any time" as the whole answer, in both directions', () => {
    expect(nextTimes(['morning', 'evening'], ANY_TIME_ID)).toEqual([ANY_TIME_ID]);
    // Picking a window after "any time" means the window, not both.
    expect(nextTimes([ANY_TIME_ID], 'afternoon')).toEqual(['afternoon']);
    expect(nextTimes([ANY_TIME_ID], ANY_TIME_ID)).toEqual([]);
  });
});

describe('callTimeSummary', () => {
  it('reads in day order however the boxes were tapped', () => {
    expect(callTimeSummary(['evening', 'early', 'morning'])).toBe('Early morning (before 8), Morning, Evening (after 6)');
  });

  it('ignores an id that is not one of the windows', () => {
    expect(callTimeSummary(['morning', 'whenever'])).toBe('Morning');
  });
});

describe('toCallbackRecord', () => {
  const record = toCallbackRecord(request, '2026-round-1', new Date('2026-09-24T02:00:00.000Z'));

  it('is a contact record the existing table and export already accept', () => {
    expect(contactRecordSchema.safeParse(record).success).toBe(true);
    expect(record.preferredContactMethod).toBe('phone');
    expect(record.preferredContactTime).toBe('Early morning (before 8), Evening (after 6)');
    expect(record.submittedAt).toBe('2026-09-24T02:00:00.000Z');
  });

  it('asks for nothing it was not given, and never marks itself as test data', () => {
    expect(record.organisation).toBe('');
    expect(record.broadRole).toBe('');
    expect(record.region).toBe('');
    expect(record.email).toBe('');
    expect(record.isTestData).toBe(false);
  });

  it('is recognisable as a callback wherever contacts are listed', () => {
    expect(isCallbackRequest(record)).toBe(true);
    expect(interestLabel(DEFAULT_QUESTIONNAIRE, CALLBACK_INTEREST_ID)).toBe('Asked us to ring them');
  });
});

describe('callbackRequestSchema', () => {
  it('needs a name, a number long enough to dial, and a window', () => {
    expect(callbackRequestSchema.safeParse(request).success).toBe(true);
    expect(callbackRequestSchema.safeParse({ ...request, name: '  ' }).success).toBe(false);
    expect(callbackRequestSchema.safeParse({ ...request, times: [] }).success).toBe(false);
    // Four digits is a typo, not a phone number.
    expect(callbackRequestSchema.safeParse({ ...request, phone: '0400' }).success).toBe(false);
  });

  it('accepts a landline written the way people write one', () => {
    expect(callbackRequestSchema.safeParse({ ...request, phone: '(03) 6427 1234' }).success).toBe(true);
    expect(callbackRequestSchema.safeParse({ ...request, phone: '+61 400 000 111' }).success).toBe(true);
  });

  it('leaves the note optional', () => {
    expect(callbackRequestSchema.safeParse({ ...request, note: '' }).success).toBe(true);
  });
});

describe('CALL_TIMES', () => {
  it('offers one window per id, ending with the catch-all', () => {
    const ids = CALL_TIMES.map((time) => time.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.at(-1)).toBe(ANY_TIME_ID);
  });

  it('keeps commas out of the labels, because two of them are read back as one line', () => {
    expect(CALL_TIMES.every((time) => !time.label.includes(','))).toBe(true);
  });
});
