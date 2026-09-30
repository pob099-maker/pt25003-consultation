import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsultationResponse } from '../types';
import { toContactRow, toResponseRow } from './records';
import {
  OTHER_SOURCE,
  SOURCES,
  addressWithoutSource,
  UNLABELLED,
  arrivalSource,
  channelOf,
  forgetArrival,
  linkFor,
  rememberArrival,
  sourceFromAddress,
  sourceLabel,
  tallyRoutes,
} from './sources';

describe('sourceFromAddress', () => {
  it('reads a label from the list, however it was typed', () => {
    expect(sourceFromAddress('?src=mag22', '')).toBe('mag22');
    expect(sourceFromAddress('?src=%20MAG22%20', '')).toBe('mag22');
    // A link can carry its query inside the hash as well.
    expect(sourceFromAddress('', '#/about?src=bulletin')).toBe('bulletin');
  });

  it('never keeps a label that could name a person', () => {
    // The whole point of the fixed list: a link made up for one grower would
    // attach a name to an anonymous set of answers.
    expect(sourceFromAddress('?src=direct-frank', '')).toBe(OTHER_SOURCE);
    expect(sourceFromAddress('?src=jo.smith@example.com', '')).toBe(OTHER_SOURCE);
  });

  it('accepts a WhatsApp group label and credits it to the WhatsApp channel', () => {
    expect(sourceFromAddress('?src=chat-ballarat', '')).toBe('chat-ballarat');
    expect(channelOf('chat-ballarat')).toBe('whatsapp');
    expect(sourceLabel('chat-ballarat')).toBe('WhatsApp group, Ballarat');
    // A made-up label for one member is still refused.
    expect(sourceFromAddress('?src=chat-frank', '')).toBe(OTHER_SOURCE);
  });

  it('says nothing when there is no label', () => {
    expect(sourceFromAddress('', '')).toBeNull();
    expect(sourceFromAddress('?src=', '')).toBeNull();
    expect(sourceFromAddress('?project=REGIONAL', '#/')).toBeNull();
  });
});

describe('labels', () => {
  it('names each source, and an unknown or missing one plainly', () => {
    expect(sourceLabel('mag22')).toBe('PotatoLink magazine, issue 22');
    expect(sourceLabel(OTHER_SOURCE)).toBe('A link we do not recognise');
    expect(sourceLabel(null)).toBe(UNLABELLED);
    expect(channelOf('shared')).toBe('shared');
    expect(channelOf(OTHER_SOURCE)).toBe('other');
    expect(channelOf(null)).toBeNull();
  });

  it('keeps every code short, lower case and unique', () => {
    const ids = SOURCES.map((source) => source.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{1,40}$/);
  });

  it('builds the link to paste', () => {
    expect(linkFor('https://consultation.agaims.com.au', 'mag22')).toBe(
      'https://consultation.agaims.com.au/?src=mag22',
    );
  });
});

const response = (method: ConsultationResponse['method'], source: string | null): ConsultationResponse => ({
  id: crypto.randomUUID(),
  roundId: 'baseline',
  role: 'grower',
  pathway: 'farm',
  regions: [],
  regionOther: '',
  answers: {},
  startedAt: '2026-09-28T00:00:00.000Z',
  submittedAt: '2026-09-28T00:10:00.000Z',
  durationSeconds: 600,
  isTestData: false,
  method,
  collectedBy: null,
  consentVerbal: null,
  sessionId: null,
  source,
});

describe('tallyRoutes', () => {
  const rows = tallyRoutes([
    response('online', 'mag22'),
    response('online', 'mag22'),
    response('online', 'bulletin'),
    response('online', 'shared'),
    response('online', null),
    response('online', OTHER_SOURCE),
    response('interview_phone', null),
    response('workshop', null),
  ]);

  it('credits an online answer to its link, and anything else to how it was collected', () => {
    expect(rows[0]).toMatchObject({ key: 'magazine', count: 2 });
    const keys = rows.map((row) => row.key);
    expect(keys).toEqual(expect.arrayContaining(['newsletter', 'shared', 'unlabelled', 'other', 'interview_phone', 'workshop']));
    expect(rows.reduce((sum, row) => sum + row.count, 0)).toBe(8);
  });

  it('groups WhatsApp links under one channel and lists each group', () => {
    const chat = tallyRoutes([
      response('online', 'chat-sa'),
      response('online', 'chat-sa'),
      response('online', 'chat-qld'),
    ]).find((row) => row.key === 'whatsapp');
    expect(chat?.count).toBe(3);
    expect(chat?.parts.map((part) => part.count)).toEqual([2, 1]);
  });

  it('only breaks a channel down when there is more than one link in it', () => {
    expect(rows.find((row) => row.key === 'magazine')?.parts).toEqual([]);
  });
});

describe('a row sent to the database', () => {
  it('leaves the label out entirely when there is none, so an older table still takes it', () => {
    expect('source' in toResponseRow(response('online', null))).toBe(false);
    expect(toResponseRow(response('online', 'mag22')).source).toBe('mag22');
    const contact = {
      id: crypto.randomUUID(),
      roundId: 'baseline',
      interests: ['summary'],
      name: '',
      organisation: '',
      broadRole: '',
      region: '',
      email: 'a@example.invalid',
      phone: '',
      preferredContactMethod: 'email',
      preferredContactTime: '',
      comments: '',
      submittedAt: '2026-09-28T00:10:00.000Z',
      isTestData: false,
    };
    expect('source' in toContactRow({ ...contact, source: null })).toBe(false);
    expect(toContactRow({ ...contact, source: 'direct' }).source).toBe('direct');
  });
});

describe('remembering how somebody arrived', () => {
  let store: Map<string, string>;
  const visit = (search: string): void => {
    vi.stubGlobal('window', {
      location: { search, hash: '#/' },
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
      },
    });
  };

  beforeEach(() => {
    store = new Map();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the first labelled link, so a later visit that typed the address does not wipe it', () => {
    const now = new Date('2026-10-01T00:00:00.000Z');
    visit('?src=mag22');
    rememberArrival(now);
    visit('');
    rememberArrival(now);
    visit('?src=bulletin');
    rememberArrival(now);
    expect(arrivalSource(now)).toBe('mag22');
  });

  it('forgets once the answers are in, so the next person on the phone starts clean', () => {
    const now = new Date('2026-10-01T00:00:00.000Z');
    visit('?src=direct');
    rememberArrival(now);
    forgetArrival();
    expect(arrivalSource(now)).toBeNull();
  });

  it('stops counting a link after a month', () => {
    visit('?src=mag22');
    rememberArrival(new Date('2026-10-01T00:00:00.000Z'));
    expect(arrivalSource(new Date('2026-10-20T00:00:00.000Z'))).toBe('mag22');
    expect(arrivalSource(new Date('2026-11-15T00:00:00.000Z'))).toBeNull();
  });
});

describe('the label in the address', () => {
  it('is taken out once read, so a reload after sending does not credit the next person', () => {
    expect(addressWithoutSource('/', '?src=mag22', '#/thank-you')).toBe('/#/thank-you');
    expect(addressWithoutSource('/demo/', '?src=mag22&v=1', '#/')).toBe('/demo/?v=1#/');
    expect(addressWithoutSource('/', '', '#/')).toBeNull();
  });

  it('falls back to a label in the hash when the query names an empty one', () => {
    expect(sourceFromAddress('?src=', '#/?src=mag22')).toBe('mag22');
  });

  it('builds links for the deployment they are shown in', () => {
    expect(linkFor('https://consultation.agaims.com.au', 'shared', '/demo/')).toBe(
      'https://consultation.agaims.com.au/demo/?src=shared',
    );
  });
});
