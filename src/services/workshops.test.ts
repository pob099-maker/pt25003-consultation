import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { consultationResponseSchema } from '../schemas/consultation';
import {
  MIN_ANSWERS,
  answersFromVotes,
  joinUrl,
  newWorkshopCode,
  normaliseCode,
  stateFrom,
  tallyRows,
  toggleChoice,
  workshopQuestions,
  type DemoWorkshop,
  type WorkshopQuestion,
} from './workshops';

const q = DEFAULT_QUESTIONNAIRE;
const byId = (id: string): WorkshopQuestion => {
  const found = workshopQuestions(q).find((question) => question.id === id);
  if (found === undefined) throw new Error(`no workshop question ${id}`);
  return found;
};

const demo = (votes: Record<string, readonly string[]>, revealed: boolean): DemoWorkshop => ({
  id: '33333333-3333-4333-8333-333333333333',
  code: 'ABCDEF',
  title: 'Ballarat field day',
  roundId: '2026-pilot',
  status: 'open',
  questionIds: ['q1_constraints'],
  createdAt: '2026-10-01T00:00:00.000Z',
  index: 0,
  revealed,
  votes: { q1_constraints: votes },
});

const people = (count: number): Record<string, readonly string[]> =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [`p${i}`, i % 2 === 0 ? ['harvest'] : ['harvest', 'skills']]));

describe('join codes', () => {
  it('uses six characters with nothing easily misread', () => {
    for (let i = 0; i < 50; i += 1) expect(newWorkshopCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it('forgives lower case and stray spaces', () => {
    expect(normaliseCode(' ab c-def ')).toBe('ABCDEF');
  });

  it('builds a link that opens the phone screen', () => {
    expect(joinUrl('ABCDEF', 'https://consultation.agaims.com.au/')).toBe(
      'https://consultation.agaims.com.au/#/w/ABCDEF',
    );
  });
});

describe('workshopQuestions', () => {
  it('offers only what can be answered by tapping', () => {
    const kinds = new Set(workshopQuestions(q).map((question) => question.kind));
    expect([...kinds].every((kind) => ['multi', 'single', 'rank'].includes(kind))).toBe(true);
    expect(workshopQuestions(q).length).toBeGreaterThan(0);
  });
});

describe('toggleChoice', () => {
  it('stops a ranking at its limit', () => {
    const rank = workshopQuestions(q).find((question) => question.kind === 'rank');
    if (rank === undefined || rank.kind !== 'rank') throw new Error('no rank question');
    const ids = rank.fallbackOptions.map((option) => option.id);
    let picked: readonly string[] = [];
    for (const id of ids) picked = toggleChoice(rank, picked, id);
    expect(picked).toHaveLength(rank.count);
    expect(toggleChoice(rank, picked, picked[0] ?? '')).toHaveLength(rank.count - 1);
  });
});

describe('stateFrom', () => {
  it('keeps results hidden until revealed', () => {
    const state = stateFrom(demo(people(8), false));
    expect(state.answered).toBe(8);
    expect(state.results).toBeNull();
  });

  it(`keeps results hidden below ${MIN_ANSWERS} answers, even when revealed`, () => {
    expect(stateFrom(demo(people(MIN_ANSWERS - 1), true)).results).toBeNull();
  });

  it('counts each person once per choice once enough have answered', () => {
    const state = stateFrom(demo(people(6), true));
    expect(state.results).toEqual({ harvest: 6, skills: 3 });
    const rows = tallyRows(byId('q1_constraints'), state.results ?? {}, state.answered);
    expect(rows[0]).toMatchObject({ id: 'harvest', hands: 6, share: 1 });
  });
});

describe('answersFromVotes', () => {
  it('turns a phone into a valid workshop response', () => {
    const answers = answersFromVotes(q, { q1_constraints: ['harvest', 'skills'], nonsense: ['x'] });
    expect(answers).toEqual({ q1_constraints: { kind: 'multi', values: ['harvest', 'skills'] } });
    const response = {
      id: crypto.randomUUID(),
      roundId: '2026-pilot',
      role: null,
      pathway: null,
      regions: [],
      regionOther: '',
      answers,
      startedAt: '2026-10-01T00:00:00.000Z',
      submittedAt: '2026-10-01T00:30:00.000Z',
      durationSeconds: 1800,
      isTestData: false,
      method: 'workshop' as const,
      collectedBy: null,
      consentVerbal: null,
      sessionId: '33333333-3333-4333-8333-333333333333',
    };
    expect(consultationResponseSchema.safeParse(response).success).toBe(true);
    expect(consultationResponseSchema.safeParse({ ...response, sessionId: null }).success).toBe(false);
    expect(consultationResponseSchema.safeParse({ ...response, method: 'online' }).success).toBe(false);
  });
});
