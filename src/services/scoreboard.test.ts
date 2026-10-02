import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { QUOTE_OK_ID } from '../content/lookup';
import { PROJECTS } from '../content/projects';
import { scoreboardSettingsFor } from '../content/scoreboardSettings';
import {
  THRESHOLD,
  countText,
  defaultBlocks,
  demoSeed,
  freeze,
  isWebAddress,
  itemSchema,
  movedFrom,
  newEdition,
  participation,
  publishProblems,
  quoteCandidates,
  themeEvidence,
  timeline,
  withStage,
  type Edition,
  type ScoreboardItem,
} from './scoreboard';
import type { RoundConfig } from './rounds';
import type { ConsultationResponse } from '../types';

const q = DEFAULT_QUESTIONNAIRE;
const coverage = scoreboardSettingsFor(PROJECTS.PT25003 as NonNullable<typeof PROJECTS.PT25003>).coverage;

let counter = 0;
const response = (over: Partial<ConsultationResponse> = {}): ConsultationResponse => {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    roundId: 'baseline',
    role: 'grower',
    pathway: 'farm',
    regions: ['sa_murraylands'],
    regionOther: '',
    answers: {},
    startedAt: '2026-10-05T00:00:00.000Z',
    submittedAt: '2026-10-05T00:10:00.000Z',
    durationSeconds: 600,
    isTestData: false,
    method: 'online',
    collectedBy: null,
    consentVerbal: null,
    sessionId: null,
    source: null,
    ...over,
  };
};

const many = (count: number, over: Partial<ConsultationResponse> = {}): ConsultationResponse[] =>
  Array.from({ length: count }, () => response(over));

const rounds: RoundConfig[] = [
  { roundId: 'pilot', label: 'Pilot', stage: 'pilot', overrides: {}, isActive: false },
  { roundId: 'baseline', label: 'Baseline', stage: 'baseline', overrides: {}, isActive: true },
];

const numbersFor = (responses: readonly ConsultationResponse[], period = '2026-10', now = new Date('2026-11-01T00:00:00')) =>
  participation({ responses, groups: [], rounds, coverage, scope: 'national', period, now });

const item = (over: Partial<ScoreboardItem> = {}): ScoreboardItem => ({
  id: crypto.randomUUID(),
  title: 'Build an evaluation framework',
  scope: 'national',
  stage: 'scoped',
  owner: 'Potato Mech',
  progress: 'Measures drafted.',
  nextMilestone: 'Review with growers',
  milestoneMonth: '2026-12',
  planRef: '',
  reason: '',
  themes: ['ROI'],
  featured: true,
  history: [{ stage: 'scoped', at: '2026-10-02T00:00:00.000Z' }],
  updatedBy: 'peter@example.com',
  updatedAt: '2026-10-02T00:00:00.000Z',
  ...over,
});

const edition = (over: Partial<Edition['content']> = {}): Edition => {
  const fresh = newEdition({ id: crypto.randomUUID(), period: '2026-10', scope: 'national', kind: 'monthly', previous: null, by: 'peter@example.com', now: new Date('2026-10-20') });
  return {
    ...fresh,
    content: {
      ...fresh.content,
      statement: 'Labour and payback came up most.',
      findings: [{ id: 'a', theme: 'ROI', said: { kind: 'summary', text: 'Growers want proof.' }, heard: 'Evidence matters.', howWeKnow: '', regionsRaised: 2, regionsHeardFrom: 3 }],
      next: { headline: 'Have your say', buttonLabel: 'Take part', url: 'https://consultation.agaims.com.au/?src=scoreboard' },
      ...over,
    },
  };
};

describe('participation', () => {
  it('publishes nothing under 5: four contributions read as fewer than five, and are never stored', () => {
    const numbers = numbersFor(many(THRESHOLD - 1));
    expect(numbers.total).toBeNull();
    expect(countText(numbers.total)).toBe('Fewer than 5');
    expect(numbersFor(many(THRESHOLD)).total).toBe(THRESHOLD);
  });

  it('leaves out test answers and pilot rounds', () => {
    const numbers = numbersFor([...many(6), ...many(9, { isTestData: true }), ...many(9, { roundId: 'pilot' })]);
    expect(numbers.total).toBe(6);
  });

  it('splits by how people took part, hiding any way with fewer than 5', () => {
    const numbers = numbersFor([...many(7), ...many(5, { method: 'interview_phone' }), ...many(2, { method: 'workshop' })]);
    expect(numbers).toMatchObject({ total: 14, online: 7, interviews: 5, workshops: null });
  });

  it('counts a region as heard from at 5, from any of the answers that make it up, and never as a count', () => {
    const numbers = numbersFor([
      ...many(3, { regions: ['sa_murraylands'] }),
      ...many(2, { regions: ['sa_southeast'] }),
      ...many(4, { regions: ['tas_north'] }),
      ...many(6, { regions: ['vic_other'] }),
    ]);
    const heard = (id: string) => numbers.regions.find((region) => region.id === id)?.heardFrom;
    expect(heard('sa')).toBe(true);
    expect(heard('tas')).toBe(false);
    // "Victoria: other districts" belongs to no region: it counts nationally only.
    expect(numbers.regions.filter((region) => region.heardFrom)).toHaveLength(1);
    expect(numbers.total).toBe(15);
    expect(JSON.stringify(numbers.regions)).not.toMatch(/\d/);
  });

  it('stops counting at the end of the month the edition reports on', () => {
    const numbers = numbersFor([...many(5), ...many(5, { submittedAt: '2026-11-03T00:00:00.000Z' })], '2026-10', new Date('2026-11-20'));
    expect(numbers.total).toBe(5);
  });

  it('draws the running total from the first week it reaches 5, flat through to the end of the month', () => {
    const numbers = numbersFor([
      ...many(3, { submittedAt: '2026-10-01T09:00:00.000Z' }),
      ...many(3, { submittedAt: '2026-10-09T09:00:00.000Z' }),
      ...many(3, { submittedAt: '2026-10-16T09:00:00.000Z' }),
    ]);
    // Weeks end on 8, 15, 22 and 29 October, then the month ends on the 31st.
    expect(numbers.weekly.map((week) => week.cumulative)).toEqual([6, 9, 9, 9]);
  });
});

describe('the evidence behind a finding', () => {
  it('counts tagged comments and how many regions heard from raised the theme', () => {
    const sa = many(5, { regions: ['sa_murraylands'] });
    const tas = many(5, { regions: ['tas_north'] });
    const tags = { [`${sa[0]?.id}:q4_bad_season`]: ['Labour'], [`${tas[0]?.id}:q4_bad_season`]: ['Labour'], [`${tas[1]?.id}:q4_bad_season`]: ['ROI'] };
    const labour = themeEvidence([...sa, ...tas], tags, coverage).find((entry) => entry.theme === 'Labour');
    expect(labour).toEqual({ theme: 'Labour', comments: 2, regionsRaised: 2, regionsHeardFrom: 2 });
  });

  it('only offers comments from somebody who said yes to being quoted', () => {
    const yes = response({ answers: { q4_bad_season: { kind: 'text', value: 'Harvest ran a month late.' }, [QUOTE_OK_ID]: { kind: 'single', value: 'yes' } } });
    const no = response({ answers: { q4_bad_season: { kind: 'text', value: 'Do not use this.' }, [QUOTE_OK_ID]: { kind: 'single', value: 'no' } } });
    const unasked = response({ answers: { q4_bad_season: { kind: 'text', value: 'Never asked.' } } });
    const offered = quoteCandidates(q, [yes, no, unasked], {}).map((quote) => quote.text);
    expect(offered).toEqual(['Harvest ran a month late.']);
  });
});

describe('publishing', () => {
  const enough = numbersFor(many(8));

  it('is ready when the four blocks are filled in', () => {
    expect(publishProblems(edition(), [item()], enough)).toEqual([]);
  });

  it('never checks a block that is switched off', () => {
    const bare = edition({ blocks: { ...defaultBlocks(), heard: false, acting: false, next: false }, findings: [], next: { headline: '', buttonLabel: '', url: '' } });
    expect(publishProblems(bare, [], enough)).toEqual([]);
  });

  it('refuses findings below the threshold', () => {
    expect(publishProblems(edition(), [item()], numbersFor(many(3))).join(' ')).toMatch(/at least 5 contributions/);
  });

  it('refuses a button that is not an ordinary web address', () => {
    expect(isWebAddress('javascript:alert(1)')).toBe(false);
    expect(isWebAddress('https://potatolink.com.au')).toBe(true);
    const bad = edition({ next: { headline: 'Go', buttonLabel: 'Go', url: 'javascript:alert(1)' } });
    expect(publishProblems(bad, [item()], enough).join(' ')).toMatch(/https:/);
  });

  it('holds the optional blocks to their own rules only when they are on', () => {
    const story = edition({ blocks: { ...defaultBlocks(), story: true }, story: { text: 'A grower changed.', why: 'It shows payback.', consent: false } });
    expect(publishProblems(story, [item()], enough)).toEqual(['Confirm the person agreed to the story being used.']);
  });

  it('shows five commitments at most, and never one that is not going ahead', () => {
    const six = Array.from({ length: 6 }, () => item());
    expect(publishProblems(edition(), six, enough).join(' ')).toMatch(/5 commitments at most/);
    const declined = item({ stage: 'not_taken_forward', reason: 'Outside levy funds.' });
    expect(publishProblems(edition(), [declined], enough).join(' ')).toMatch(/at least one commitment/);
  });

  it('freezes the numbers and items, without the staff member who edited them', () => {
    const published = freeze(edition(), [item()], enough, 'peter@example.com', new Date('2026-11-01T00:00:00.000Z'));
    expect(published.status).toBe('published');
    expect(published.publishedAt).toBe('2026-11-01T00:00:00.000Z');
    expect(published.content.snapshot?.participation.total).toBe(8);
    expect(JSON.stringify(published.content.snapshot)).not.toContain('peter@example.com');
  });
});

describe('the register', () => {
  it('will not take a no without a reason, or a hand-off without a name', () => {
    expect(itemSchema.safeParse(item({ stage: 'not_taken_forward', reason: '' })).success).toBe(false);
    expect(itemSchema.safeParse(item({ stage: 'passed_on', reason: '  ' })).success).toBe(false);
    expect(itemSchema.safeParse(item({ stage: 'passed_on', reason: 'AUSVEG' })).success).toBe(true);
  });

  it('records a stage change, and says it moved up in the month it happened', () => {
    const moved = withStage(item(), 'underway', new Date('2026-10-20T00:00:00.000Z'));
    expect(moved.history.map((change) => change.stage)).toEqual(['scoped', 'underway']);
    expect(movedFrom(moved, '2026-10')).toBe('scoped');
    expect(movedFrom(moved, '2026-11')).toBeNull();
    expect(withStage(moved, 'underway', new Date())).toBe(moved);
  });

  it('places next milestones on the five months that follow', () => {
    const months = timeline([item({ milestoneMonth: '2026-12' })], '2026-10');
    expect(months.map((month) => month.period)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02', '2027-03']);
    expect(months[1]?.items).toHaveLength(1);
  });
});

describe('a new edition', () => {
  it('carries the switches, the next step and the answers over, and starts the rest fresh', () => {
    const before = edition({
      blocks: { ...defaultBlocks(), asked: true },
      asked: [{ question: 'Will results be public?', answer: 'Yes.' }],
      story: { text: 'A story', why: 'Why', consent: true },
    });
    const next = newEdition({ id: crypto.randomUUID(), period: '2026-11', scope: 'national', kind: 'monthly', previous: before, by: 'x', now: new Date('2026-11-02') });
    expect(next.content.blocks.asked).toBe(true);
    expect(next.content.asked).toHaveLength(1);
    expect(next.content.next.url).toBe(before.content.next.url);
    expect(next.content.statement).toBe('');
    expect(next.content.findings).toEqual([]);
    expect(next.content.story.text).toBe('');
    expect(next.content.nextUpdate).toBe('1 December 2026');
  });

  it('switches on the playback for an annual edition', () => {
    const annual = newEdition({ id: crypto.randomUUID(), period: '2026-12', scope: 'national', kind: 'annual', previous: null, by: 'x', now: new Date() });
    expect(annual.content.blocks.playback).toBe(true);
  });
});

describe('the demonstration', () => {
  it('has a published example with no staff address in it', () => {
    const seed = demoSeed(new Date('2026-11-10'));
    const published = seed.editions[0];
    expect(published?.status).toBe('published');
    expect(published?.content.snapshot?.items.length).toBeGreaterThan(0);
    expect(JSON.stringify(published?.content.snapshot)).not.toContain('@');
  });
});
