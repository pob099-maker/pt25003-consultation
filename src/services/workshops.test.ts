import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { consultationResponseSchema } from '../schemas/consultation';
import {
  MIN_ANSWERS,
  answersFromVotes,
  cleanWords,
  cloudWords,
  decodeRating,
  encodeRating,
  isChoiceQuestion,
  joinUrl,
  newWorkshopCode,
  normaliseCode,
  ratingRows,
  stateFrom,
  tallyRows,
  toggleChoice,
  workshopQuestions,
  type ChoiceQuestion,
  type DemoWorkshop,
} from './workshops';

const q = DEFAULT_QUESTIONNAIRE;
const byId = (id: string) => {
  const found = workshopQuestions(q).find((question) => question.id === id);
  if (found === undefined) throw new Error(`no workshop question ${id}`);
  return found;
};

const choice = (id: string): ChoiceQuestion => {
  const found = byId(id);
  if (!isChoiceQuestion(found)) throw new Error(`${id} is not a choice question`);
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
  it('offers bars, ratings and word clouds, but no role branches', () => {
    const kinds = new Set(workshopQuestions(q).map((question) => question.kind));
    expect(kinds.has('rating')).toBe(true);
    expect(kinds.has('text')).toBe(true);
    expect(workshopQuestions(q).some((question) => question.id === 'farm_pressure')).toBe(false);
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
    const rows = tallyRows(choice('q1_constraints'), state.results ?? {}, state.answered);
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

describe('ratings in a workshop', () => {
  it('round-trips through the vote format', () => {
    expect(decodeRating(encodeRating({ labour: 4, harvest_efficiency: 2 }))).toEqual({
      labour: 4,
      harvest_efficiency: 2,
    });
    expect(decodeRating(['labour=9', 'nonsense'])).toEqual({});
  });

  it('averages each row and shows the spread', () => {
    const question = byId('q5_areas');
    if (question.kind !== 'rating') throw new Error('q5_areas should be a rating');
    const [first, second] = question.rows;
    if (first === undefined || second === undefined) throw new Error('need two rows');
    const rows = ratingRows(question, { [`${first.id}=5`]: 3, [`${first.id}=3`]: 1, [`${second.id}=2`]: 4 });
    expect(rows[0]).toMatchObject({ id: first.id, rated: 4, mean: 4.5, high: 0.75, scores: [0, 0, 1, 0, 3] });
    expect(rows[1]).toMatchObject({ id: second.id, mean: 2 });
    expect(rows.at(-1)?.rated).toBe(0);
  });

  it('becomes a rating answer, dropping rows the question does not have', () => {
    const question = byId('q5_areas');
    if (question.kind !== 'rating') throw new Error('q5_areas should be a rating');
    const row = question.rows[0]?.id ?? '';
    expect(answersFromVotes(q, { q5_areas: [`${row}=4`, 'made_up=5'] })).toEqual({
      q5_areas: { kind: 'rating', values: { [row]: 4 } },
    });
  });
});

describe('word clouds', () => {
  it('trims, lower-cases, de-duplicates and caps what a phone sends', () => {
    expect(cleanWords(['  Labour ', 'labour', '', 'Wet   harvest', 'skills', 'extra'])).toEqual([
      'labour',
      'wet harvest',
      'skills',
    ]);
  });

  it('counts a word once per person, whatever the case, and leaves hidden words out', () => {
    const workshop: DemoWorkshop = {
      ...demo({}, true),
      questionIds: ['q4_bad_season'],
      votes: {
        q4_bad_season: {
          a: ['Labour', 'labour '],
          b: ['labour'],
          c: ['rain'],
          d: ['rude word'],
          e: ['Rain'],
        },
      },
      hidden: { q4_bad_season: ['rude word'] },
    };
    const state = stateFrom(workshop);
    expect(state.results).toEqual({ labour: 2, rain: 2 });
    expect(state.hidden).toEqual(['rude word']);
    expect(cloudWords(state.results ?? {}).map((item) => item.word)).toEqual(['labour', 'rain']);
  });

  it('becomes a text answer', () => {
    expect(answersFromVotes(q, { q4_bad_season: ['Labour', 'wet harvest'] })).toEqual({
      q4_bad_season: { kind: 'text', value: 'labour; wet harvest' },
    });
  });
});
