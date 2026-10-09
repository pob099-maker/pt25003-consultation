import { z } from 'zod';
import { getSupabase } from '../lib/supabase';
import { STORAGE_KEYS, readJson, writeJson } from '../lib/storage';
import { currentProject } from '../content/projects';
import type { CoverageRegion } from '../content/scoreboardSettings';
import { freeTextEntries, type FreeTextEntry } from './analysis';
import { THEME_TAGS, tagKey, type TagMap } from './tags';
import type { RoundConfig } from './rounds';
import type { GroupRecord } from './groups';
import type { ConsultationResponse, Questionnaire, Result } from '../types';

/**
 * The monthly scoreboard: "You said. We heard. We're acting."
 *
 * The team drafts a month in the admin area, and publishing freezes it: the
 * numbers, the findings and the commitments exactly as the page showed them,
 * so history never changes underneath a reader. The public page reads only
 * published editions, never a response.
 *
 * Four blocks make the page. Everything else is there to use when it helps
 * and is off until somebody turns it on.
 */

export const EDITIONS_TABLE = 'consultation_scoreboard_editions';
export const ITEMS_TABLE = 'consultation_scoreboard_items';

export const MOTTO = "You said. We heard. We're acting.";

/**
 * Nothing on the scoreboard rests on fewer than this many contributions:
 * no number, no finding and no quote, nationally or for a region. A figure
 * under it is never stored in a published edition at all, because the public
 * can read an edition's data as well as its page.
 */
export const THRESHOLD = 5;

/** The page never shows more than this many findings or commitments. */
export const MAX_SHOWN = 5;

export const STAGES = ['listening', 'scoped', 'underway', 'delivered', 'not_taken_forward', 'passed_on'] as const;
export type Stage = (typeof STAGES)[number];

/** The four steps a commitment moves through, in order. */
export const TRACK: readonly Stage[] = ['listening', 'scoped', 'underway', 'delivered'];

export const STAGE_LABEL: Readonly<Record<Stage, string>> = {
  listening: 'Listening',
  scoped: 'Scoped',
  underway: 'Underway',
  delivered: 'Delivered',
  not_taken_forward: 'Not taking forward',
  passed_on: 'Passed on',
};

/** Saying no, or passing something on, always says why or to whom. */
export const needsReason = (stage: Stage): boolean => stage === 'not_taken_forward' || stage === 'passed_on';

export interface StageChange {
  readonly stage: Stage;
  readonly at: string;
}

/** One line of the register: something people raised, or something the project committed to. */
export interface ScoreboardItem {
  readonly id: string;
  readonly title: string;
  /** 'national', or a region id for a project with regional pages. */
  readonly scope: string;
  readonly stage: Stage;
  readonly owner: string;
  readonly progress: string;
  readonly nextMilestone: string;
  /** yyyy-mm, so the milestone can sit on the timeline. */
  readonly milestoneMonth: string | null;
  /** The plan item or milestone it delivers, such as "Milestone 102". */
  readonly planRef: string;
  /** Why it is not being taken forward, or who it was passed to. */
  readonly reason: string;
  readonly themes: readonly string[];
  /** Among the month's commitments, of which the page shows five at most. */
  readonly featured: boolean;
  readonly history: readonly StageChange[];
  readonly updatedBy: string;
  readonly updatedAt: string;
}

/** What a published edition keeps of an item: everything but who last edited it. */
export type PublicItem = Omit<ScoreboardItem, 'updatedBy'>;

export type BlockId =
  | 'participation'
  | 'heard'
  | 'acting'
  | 'next'
  | 'timeline'
  | 'register'
  | 'story'
  | 'asked'
  | 'check'
  | 'playback';

export interface BlockInfo {
  readonly id: BlockId;
  readonly label: string;
  readonly description: string;
  /** The four blocks every edition starts with. The rest start switched off. */
  readonly core: boolean;
  /** Where the idea came from, for the options that came from other programs. */
  readonly from?: string;
}

export const BLOCKS: readonly BlockInfo[] = [
  { id: 'participation', core: true, label: 'Who has taken part', description: 'Contributions to date, how people took part, and which regions have been heard from.' },
  { id: 'heard', core: true, label: 'What we heard', description: 'Up to five findings, each with what people said and what the project took from it.' },
  { id: 'acting', core: true, label: "What we're doing", description: 'Up to five commitments, each with its stage, latest progress and next milestone.' },
  { id: 'next', core: true, label: 'Your next opportunity', description: 'One easy next step for the reader.' },
  { id: 'timeline', core: false, label: 'Coming up', description: 'The next milestones of the commitments shown, month by month.' },
  { id: 'register', core: false, label: 'Everything you raised', description: 'Every issue and commitment and what happened to it, including what is not going ahead and what was passed on.', from: 'MLA and GRDC regional consultation; the US land-grant rule' },
  { id: 'story', core: false, label: 'Story of the month', description: 'One change story, used with permission, and why it was chosen.', from: 'Most Significant Change, first used in Australia by Target 10' },
  { id: 'asked', core: false, label: 'You asked', description: 'Short answers to questions people raised.', from: 'Interactive farm radio, Tanzania' },
  { id: 'check', core: false, label: 'Checked before publishing', description: 'A regional rep or advisory group confirms the findings first, and the page says so.', from: "GRDC's Regional Cropping Solutions Networks" },
  { id: 'playback', core: false, label: 'Annual playback', description: 'How input was used over the year, and one question about whether this page is useful.', from: "Dairy Australia's consultation playback" },
];

export interface Finding {
  readonly id: string;
  readonly theme: string;
  /** A quote only where the person said yes to being quoted; anything else is a summary and says so. */
  readonly said: { readonly kind: 'quote' | 'summary'; readonly text: string };
  readonly heard: string;
  readonly howWeKnow: string;
  /** How many regions raised it, out of the regions heard from. Null hides the dots. */
  readonly regionsRaised: number | null;
  readonly regionsHeardFrom: number | null;
}

export interface Participation {
  /** Null below the threshold, so a small number is never published. */
  readonly total: number | null;
  readonly online: number | null;
  readonly interviews: number | null;
  readonly workshops: number | null;
  /** People in group discussions: a room, reported beside the individual answers, never added to them. */
  readonly groupPeople: number | null;
  /** Running total at the end of each week, from the first week it reached the threshold. */
  readonly weekly: readonly { readonly weekEnding: string; readonly cumulative: number }[];
  /** Whether each region has reached the threshold. A tile is heard from or not, never a count. */
  readonly regions: readonly { readonly id: string; readonly heardFrom: boolean }[];
}

export interface Snapshot {
  readonly takenAt: string;
  readonly participation: Participation;
  readonly items: readonly PublicItem[];
}

export interface EditionContent {
  readonly statement: string;
  readonly blocks: Readonly<Record<BlockId, boolean>>;
  /** "Where we need you": the gap the project is trying to fill. */
  readonly needYou: string;
  /** Activities held outside the tool, such as field visits or webinar polls. */
  readonly otherActivities: readonly { readonly label: string; readonly count: number }[];
  readonly findings: readonly Finding[];
  readonly next: { readonly headline: string; readonly buttonLabel: string; readonly url: string };
  readonly nextUpdate: string;
  readonly story: { readonly text: string; readonly why: string; readonly consent: boolean };
  readonly asked: readonly { readonly question: string; readonly answer: string }[];
  readonly check: { readonly by: string; readonly on: string };
  readonly playback: { readonly howUsed: string; readonly usefulUrl: string };
  /** Frozen at publication. Null in a draft, which shows today's numbers instead. */
  readonly snapshot: Snapshot | null;
}

export type EditionKind = 'monthly' | 'annual';

export interface Edition {
  readonly id: string;
  /** yyyy-mm */
  readonly period: string;
  readonly scope: string;
  readonly kind: EditionKind;
  readonly status: 'draft' | 'published';
  readonly content: EditionContent;
  readonly updatedBy: string;
  readonly updatedAt: string;
  readonly publishedBy: string | null;
  readonly publishedAt: string | null;
}

// ---------------------------------------------------------------------------
// Words and dates

/** A figure as the page shows it: the number, or "Fewer than 5". */
export const countText = (value: number | null): string =>
  value === null ? `Fewer than ${THRESHOLD}` : value.toLocaleString('en-AU');

const suppress = (value: number): number | null => (value >= THRESHOLD ? value : null);

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isPeriod = (value: string): boolean => PERIOD.test(value);

export const periodOf = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/** yyyy-mm, moved by a number of months. */
export const addMonths = (period: string, months: number): string => {
  const [year, month] = period.split('-').map(Number) as [number, number];
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
};

export const monthLabel = (period: string, style: 'long' | 'short' = 'long'): string => {
  const [year, month] = period.split('-').map(Number) as [number, number];
  return new Intl.DateTimeFormat('en-AU', { month: style, year: style === 'long' ? 'numeric' : undefined }).format(
    new Date(year, month - 1, 1),
  );
};

/** The last moment of a month, local time. */
const endOfPeriod = (period: string): Date => {
  const [year, month] = period.split('-').map(Number) as [number, number];
  return new Date(year, month, 1, 0, 0, 0, -1);
};

export const firstOfNextMonth = (period: string): string => {
  const [year, month] = addMonths(period, 1).split('-').map(Number) as [number, number];
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  );
};

/** Only an ordinary web address may go behind a button the public presses. */
export const isWebAddress = (value: string): boolean => {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// The numbers

/** The answers that count: real ones, from rounds other than a pilot. */
export const countingResponses = (
  responses: readonly ConsultationResponse[],
  rounds: readonly RoundConfig[],
): readonly ConsultationResponse[] => {
  const pilots = new Set(rounds.filter((round) => round.stage === 'pilot').map((round) => round.roundId));
  return responses.filter((response) => !response.isTestData && !pilots.has(response.roundId));
};

/** Whether a response counts towards a coverage region. */
const inRegion = (response: ConsultationResponse, region: CoverageRegion): boolean =>
  response.regions.some((id) => region.from.includes(id));

/** The responses a scope covers: everything nationally, or one region's. */
export const inScope = (
  responses: readonly ConsultationResponse[],
  scope: string,
  coverage: readonly CoverageRegion[],
): readonly ConsultationResponse[] => {
  if (scope === 'national') return responses;
  const region = coverage.find((candidate) => candidate.id === scope);
  return region === undefined ? [] : responses.filter((response) => inRegion(response, region));
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Who has taken part, as at the end of the edition's month or now, whichever
 * comes first. Every figure under the threshold is left out rather than
 * published and hidden.
 */
export const participation = (input: {
  readonly responses: readonly ConsultationResponse[];
  readonly groups: readonly GroupRecord[];
  readonly rounds: readonly RoundConfig[];
  readonly coverage: readonly CoverageRegion[];
  readonly scope: string;
  readonly period: string;
  readonly now: Date;
}): Participation => {
  const cutoff = Math.min(endOfPeriod(input.period).getTime(), input.now.getTime());
  const counted = inScope(countingResponses(input.responses, input.rounds), input.scope, input.coverage).filter(
    (response) => new Date(response.submittedAt).getTime() <= cutoff,
  );
  const pilots = new Set(input.rounds.filter((round) => round.stage === 'pilot').map((round) => round.roundId));
  const groupPeople =
    input.scope === 'national'
      ? input.groups
          .filter((group) => !pilots.has(group.roundId) && new Date(group.heldOn).getTime() <= cutoff)
          .reduce((sum, group) => sum + group.present, 0)
      : 0;

  const times = counted.map((response) => new Date(response.submittedAt).getTime()).sort((a, b) => a - b);
  const weekly: { weekEnding: string; cumulative: number }[] = [];
  if (times.length > 0) {
    const start = times[0] as number;
    let index = 0;
    for (let end = start + 7 * DAY; ; end += 7 * DAY) {
      const until = Math.min(end, cutoff);
      while (index < times.length && (times[index] as number) <= until) index += 1;
      if (index >= THRESHOLD) weekly.push({ weekEnding: new Date(until).toISOString().slice(0, 10), cumulative: index });
      if (until >= cutoff) break;
    }
  }

  return {
    total: suppress(counted.length),
    online: suppress(counted.filter((response) => response.method === 'online').length),
    interviews: suppress(counted.filter((response) => response.method.startsWith('interview_')).length),
    workshops: suppress(counted.filter((response) => response.method === 'workshop').length),
    groupPeople: suppress(groupPeople),
    weekly,
    regions: input.coverage.map((region) => ({
      id: region.id,
      heardFrom: counted.filter((response) => inRegion(response, region)).length >= THRESHOLD,
    })),
  };
};

export interface ThemeEvidence {
  readonly theme: string;
  /** Comments tagged with the theme. */
  readonly comments: number;
  /** Regions heard from where at least one tagged comment came from. */
  readonly regionsRaised: number;
  readonly regionsHeardFrom: number;
}

/**
 * Behind each finding: how often a theme was tagged in the comments, and how
 * many of the regions heard from raised it. Counting regions gives each one
 * voice, so the regions that answer most cannot set the story on their own.
 * For the team only; the page shows what the team decides it means.
 */
export const themeEvidence = (
  responses: readonly ConsultationResponse[],
  tags: TagMap,
  coverage: readonly CoverageRegion[],
): readonly ThemeEvidence[] => {
  const byId = new Map(responses.map((response) => [response.id, response]));
  const heardFrom = coverage.filter(
    (region) => responses.filter((response) => inRegion(response, region)).length >= THRESHOLD,
  );
  const themes = new Set<string>(THEME_TAGS);
  for (const list of Object.values(tags)) for (const tag of list) themes.add(tag);
  const evidence = [...themes].map((theme) => {
    const tagged = Object.entries(tags)
      .filter(([key, list]) => list.includes(theme) && byId.has(key.split(':')[0] ?? ''))
      .map(([key]) => byId.get(key.split(':')[0] ?? '') as ConsultationResponse);
    return {
      theme,
      comments: tagged.length,
      regionsRaised: heardFrom.filter((region) => tagged.some((response) => inRegion(response, region))).length,
      regionsHeardFrom: heardFrom.length,
    };
  });
  return evidence.filter((entry) => entry.comments > 0).sort((a, b) => b.comments - a.comments);
};

export interface QuoteCandidate extends FreeTextEntry {
  readonly themes: readonly string[];
}

/**
 * Comments that may be quoted. Every one may, without a name, as the privacy
 * statement says: the consultation is anonymous, so nobody is asked
 * separately. Whether the words themselves could identify somebody is still
 * the team's call, made when one is chosen.
 */
export const quoteCandidates = (
  questionnaire: Questionnaire,
  responses: readonly ConsultationResponse[],
  tags: TagMap,
): readonly QuoteCandidate[] =>
  freeTextEntries(questionnaire, responses).map((entry) => ({
    ...entry,
    themes: tags[tagKey(entry.responseId, entry.questionId)] ?? [],
  }));

// ---------------------------------------------------------------------------
// Editions

export const defaultBlocks = (): Record<BlockId, boolean> =>
  Object.fromEntries(BLOCKS.map((block) => [block.id, block.core])) as Record<BlockId, boolean>;

/**
 * A fresh edition. The switches, the next step, the activities and the
 * answers to common questions carry over from the one before; the statement,
 * the findings, the story and the check are written new each month.
 */
export const newEdition = (input: {
  readonly id: string;
  readonly period: string;
  readonly scope: string;
  readonly kind: EditionKind;
  readonly previous: Edition | null;
  readonly by: string;
  readonly now: Date;
}): Edition => {
  const before = input.previous?.content;
  const blocks = before === undefined ? defaultBlocks() : { ...before.blocks };
  if (input.kind === 'annual') blocks.playback = true;
  return {
    id: input.id,
    period: input.period,
    scope: input.scope,
    kind: input.kind,
    status: 'draft',
    content: {
      statement: '',
      blocks,
      needYou: before?.needYou ?? '',
      otherActivities: before?.otherActivities ?? [],
      findings: [],
      next: before?.next ?? { headline: '', buttonLabel: '', url: '' },
      nextUpdate: firstOfNextMonth(input.period),
      story: { text: '', why: '', consent: false },
      asked: before?.asked ?? [],
      check: { by: '', on: '' },
      playback: { howUsed: '', usefulUrl: before?.playback.usefulUrl ?? '' },
      snapshot: null,
    },
    updatedBy: input.by,
    updatedAt: input.now.toISOString(),
    publishedBy: null,
    publishedAt: null,
  };
};

/** The items an edition shows: those in its scope, national ones included on a region's page. */
export const itemsFor = (items: readonly ScoreboardItem[], scope: string): readonly ScoreboardItem[] =>
  items.filter((item) => item.scope === scope || item.scope === 'national');

/** The commitments the page leads with. */
export const featuredItems = <T extends PublicItem>(items: readonly T[]): readonly T[] =>
  items.filter((item) => item.featured && !needsReason(item.stage)).slice(0, MAX_SHOWN);

/**
 * What stands between a draft and publishing. Each entry says what to fix.
 * The blocks that are switched off are not checked: an option is never a
 * requirement.
 */
export const publishProblems = (
  edition: Edition,
  items: readonly ScoreboardItem[],
  numbers: Participation,
): readonly string[] => {
  const problems: string[] = [];
  const { content } = edition;
  const on = content.blocks;
  if (content.statement.trim().length === 0) problems.push('Write the update statement at the top.');
  if (!Object.values(on).some(Boolean)) problems.push('Switch on at least one block.');
  if (on.heard) {
    if (numbers.total === null) {
      problems.push(`Findings need at least ${THRESHOLD} contributions. Switch "What we heard" off until then.`);
    }
    if (content.findings.length === 0) problems.push('Add at least one finding, or switch "What we heard" off.');
    if (content.findings.length > MAX_SHOWN) problems.push(`Show ${MAX_SHOWN} findings at most.`);
    content.findings.forEach((finding, index) => {
      if (finding.said.text.trim().length === 0) problems.push(`Finding ${index + 1}: add what people said.`);
      if (finding.heard.trim().length === 0) problems.push(`Finding ${index + 1}: add what we heard.`);
    });
  }
  if (on.acting) {
    const featured = itemsFor(items, edition.scope).filter((item) => item.featured && !needsReason(item.stage));
    if (featured.length === 0) problems.push('Pick at least one commitment to show, or switch "What we\'re doing" off.');
    if (featured.length > MAX_SHOWN) problems.push(`Pick ${MAX_SHOWN} commitments at most; ${featured.length} are picked.`);
  }
  if (on.next) {
    if (content.next.headline.trim().length === 0) problems.push('Say what the next opportunity is.');
    if (content.next.buttonLabel.trim().length === 0) problems.push('Give the next opportunity a button label.');
    if (!isWebAddress(content.next.url)) problems.push('The next opportunity needs a web address starting https://.');
  }
  if (on.story) {
    if (content.story.text.trim().length === 0) problems.push('Write the story of the month, or switch it off.');
    if (content.story.why.trim().length === 0) problems.push('Say why this story was chosen.');
    if (!content.story.consent) problems.push('Confirm the person agreed to the story being used.');
  }
  if (on.asked && !content.asked.some((pair) => pair.question.trim() && pair.answer.trim())) {
    problems.push('Add at least one question and answer to "You asked", or switch it off.');
  }
  if (on.check && (content.check.by.trim().length === 0 || content.check.on.trim().length === 0)) {
    problems.push('Record who checked the findings and when, or switch the check off.');
  }
  if (on.playback) {
    if (content.playback.howUsed.trim().length === 0) problems.push('Write how input was used this year.');
    if (content.playback.usefulUrl.trim().length > 0 && !isWebAddress(content.playback.usefulUrl)) {
      problems.push('The "Is this useful?" link needs a web address starting https://.');
    }
  }
  return problems;
};

/** A published item keeps everything but the staff member who last edited it. */
const toPublic = (item: ScoreboardItem): PublicItem => ({
  id: item.id,
  title: item.title,
  scope: item.scope,
  stage: item.stage,
  owner: item.owner,
  progress: item.progress,
  nextMilestone: item.nextMilestone,
  milestoneMonth: item.milestoneMonth,
  planRef: item.planRef,
  reason: item.reason,
  themes: item.themes,
  featured: item.featured,
  history: item.history,
  updatedAt: item.updatedAt,
});

/** The edition as published: frozen numbers and items, and who published it. */
export const freeze = (
  edition: Edition,
  items: readonly ScoreboardItem[],
  numbers: Participation,
  by: string,
  now: Date,
): Edition => ({
  ...edition,
  status: 'published',
  publishedBy: by,
  publishedAt: now.toISOString(),
  updatedBy: by,
  updatedAt: now.toISOString(),
  content: {
    ...edition.content,
    snapshot: { takenAt: now.toISOString(), participation: numbers, items: itemsFor(items, edition.scope).map(toPublic) },
  },
});

/** Whether an item moved stage during the edition's month, and from what. */
export const movedFrom = (item: PublicItem, period: string): Stage | null => {
  const changes = item.history;
  const last = changes[changes.length - 1];
  if (last === undefined || changes.length < 2 || !last.at.startsWith(period)) return null;
  return (changes[changes.length - 2] as StageChange).stage;
};

/** The next five months after the edition, with the shown commitments' milestones in each. */
export const timeline = (
  items: readonly PublicItem[],
  period: string,
): readonly { readonly period: string; readonly items: readonly PublicItem[] }[] =>
  [1, 2, 3, 4, 5].map((step) => {
    const month = addMonths(period, step);
    return { period: month, items: items.filter((item) => item.milestoneMonth === month) };
  });

// ---------------------------------------------------------------------------
// Validation before anything is written

const text = (max: number) => z.string().max(max);
const stageSchema = z.enum(STAGES);

export const itemSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1, 'Give it a title.').max(200),
    scope: z.string().regex(/^[a-z0-9-]{1,40}$/),
    stage: stageSchema,
    owner: text(60),
    progress: text(600),
    nextMilestone: text(200),
    milestoneMonth: z.string().regex(PERIOD).nullable(),
    planRef: text(120),
    reason: text(600),
    themes: z.array(text(60)).max(10),
    featured: z.boolean(),
    history: z.array(z.object({ stage: stageSchema, at: z.string() })).max(100),
    updatedBy: text(200),
    updatedAt: z.string(),
  })
  .superRefine((item, context) => {
    if (needsReason(item.stage) && item.reason.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message:
          item.stage === 'passed_on'
            ? 'Say who it was passed to.'
            : 'Say why it is not being taken forward. A no with a reason is still an answer.',
      });
    }
  });

const findingSchema = z.object({
  id: z.string().min(1).max(60),
  theme: text(60),
  said: z.object({ kind: z.enum(['quote', 'summary']), text: text(600) }),
  heard: text(600),
  howWeKnow: text(200),
  regionsRaised: z.number().int().min(0).max(50).nullable(),
  regionsHeardFrom: z.number().int().min(0).max(50).nullable(),
});

const contentSchema = z.object({
  statement: text(800),
  blocks: z.record(z.string(), z.boolean()),
  needYou: text(400),
  otherActivities: z.array(z.object({ label: text(80), count: z.number().int().min(0).max(100000) })).max(10),
  findings: z.array(findingSchema).max(10),
  next: z.object({ headline: text(160), buttonLabel: text(40), url: text(400) }),
  nextUpdate: text(60),
  story: z.object({ text: text(800), why: text(300), consent: z.boolean() }),
  asked: z.array(z.object({ question: text(200), answer: text(600) })).max(10),
  check: z.object({ by: text(120), on: text(20) }),
  playback: z.object({ howUsed: text(1500), usefulUrl: text(400) }),
  snapshot: z.unknown().nullable(),
});

export const editionSchema = z.object({
  id: z.string().uuid(),
  period: z.string().regex(PERIOD, 'Choose a month.'),
  scope: z.string().regex(/^[a-z0-9-]{1,40}$/),
  kind: z.enum(['monthly', 'annual']),
  status: z.enum(['draft', 'published']),
  content: contentSchema,
});

// ---------------------------------------------------------------------------
// Storage

interface EditionRow {
  id: string;
  project_id: string;
  period: string;
  scope: string;
  kind: EditionKind;
  status: 'draft' | 'published';
  content: EditionContent;
  updated_by: string;
  updated_at: string;
  published_by: string | null;
  published_at: string | null;
}

interface ItemRow {
  id: string;
  project_id: string;
  title: string;
  scope: string;
  stage: Stage;
  owner: string;
  progress: string;
  next_milestone: string;
  milestone_month: string | null;
  plan_ref: string;
  reason: string;
  themes: string[];
  featured: boolean;
  history: StageChange[];
  updated_by: string;
  updated_at: string;
}

/**
 * A stored edition, filled out to the current shape. A block added since it
 * was written stays off, so an old edition never sprouts something new.
 */
const fromEditionRow = (row: EditionRow): Edition => {
  const empty = newEdition({ id: row.id, period: row.period, scope: row.scope, kind: row.kind, previous: null, by: '', now: new Date() }).content;
  const stored: Partial<EditionContent> = row.content ?? {};
  const off = Object.fromEntries(BLOCKS.map((block) => [block.id, false])) as Record<BlockId, boolean>;
  return {
    id: row.id,
    period: row.period,
    scope: row.scope,
    kind: row.kind,
    status: row.status,
    content: { ...empty, ...stored, blocks: { ...off, ...(stored.blocks ?? empty.blocks) } },
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    publishedBy: row.published_by,
    publishedAt: row.published_at,
  };
};

const toEditionRow = (edition: Edition): EditionRow => ({
  id: edition.id,
  project_id: currentProject().id,
  period: edition.period,
  scope: edition.scope,
  kind: edition.kind,
  status: edition.status,
  content: edition.content,
  updated_by: edition.updatedBy,
  updated_at: edition.updatedAt,
  published_by: edition.publishedBy,
  published_at: edition.publishedAt,
});

const fromItemRow = (row: ItemRow): ScoreboardItem => ({
  id: row.id,
  title: row.title,
  scope: row.scope,
  stage: row.stage,
  owner: row.owner,
  progress: row.progress,
  nextMilestone: row.next_milestone,
  milestoneMonth: row.milestone_month,
  planRef: row.plan_ref,
  reason: row.reason,
  themes: row.themes ?? [],
  featured: row.featured,
  history: Array.isArray(row.history) ? row.history : [],
  updatedBy: row.updated_by,
  updatedAt: row.updated_at,
});

const toItemRow = (item: ScoreboardItem): ItemRow => ({
  id: item.id,
  project_id: currentProject().id,
  title: item.title.trim(),
  scope: item.scope,
  stage: item.stage,
  owner: item.owner.trim(),
  progress: item.progress.trim(),
  next_milestone: item.nextMilestone.trim(),
  milestone_month: item.milestoneMonth,
  plan_ref: item.planRef.trim(),
  reason: item.reason.trim(),
  themes: [...item.themes],
  featured: item.featured,
  history: [...item.history],
  updated_by: item.updatedBy,
  updated_at: item.updatedAt,
});

interface DemoStore {
  readonly editions: readonly Edition[];
  readonly items: readonly ScoreboardItem[];
}

const demoStore = (): DemoStore => readJson<DemoStore>(STORAGE_KEYS.demoScoreboard) ?? demoSeed(new Date());
const writeDemo = (store: DemoStore): void => writeJson(STORAGE_KEYS.demoScoreboard, store);

const failed = (message: string, code?: string): Result<never> => ({
  success: false,
  error:
    code === '23505'
      ? 'There is already an edition for that month.'
      : code === '42P01' || code === 'PGRST205'
        ? 'The scoreboard tables are not set up yet. Run supabase/migrations/0016_scoreboard.sql once in the SQL Editor.'
        : message,
});

/** Every edition of this project, drafts included, newest month first. For the team. */
export const loadEditions = async (): Promise<Result<readonly Edition[]>> => {
  const supabase = getSupabase();
  if (supabase === null) return { success: true, data: sortEditions(demoStore().editions) };
  const { data, error } = await supabase.from(EDITIONS_TABLE).select('*').eq('project_id', currentProject().id);
  if (error !== null) return failed(error.message, error.code);
  return { success: true, data: sortEditions((data as EditionRow[]).map(fromEditionRow)) };
};

/** Published editions only. The public page reads this and nothing else. */
export const loadPublished = async (): Promise<Result<readonly Edition[]>> => {
  const supabase = getSupabase();
  if (supabase === null) {
    return { success: true, data: sortEditions(demoStore().editions.filter((edition) => edition.status === 'published')) };
  }
  const { data, error } = await supabase
    .from(EDITIONS_TABLE)
    .select('*')
    .eq('project_id', currentProject().id)
    .eq('status', 'published');
  if (error !== null) return failed(error.message, error.code);
  return { success: true, data: sortEditions((data as EditionRow[]).map(fromEditionRow)) };
};

const sortEditions = (editions: readonly Edition[]): readonly Edition[] =>
  [...editions].sort((a, b) => b.period.localeCompare(a.period) || a.kind.localeCompare(b.kind) || a.scope.localeCompare(b.scope));

/** Saves a draft. A published edition is fixed, here and in the database. */
export const saveEdition = async (edition: Edition): Promise<Result<Edition>> => {
  if (edition.status !== 'draft') return { success: false, error: 'A published edition cannot be changed.' };
  const parsed = editionSchema.safeParse(edition);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Check the edition.' };
  const supabase = getSupabase();
  if (supabase === null) {
    const store = demoStore();
    if (store.editions.some((other) => other.id !== edition.id && sameSlot(other, edition))) {
      return failed('', '23505');
    }
    writeDemo({ ...store, editions: [edition, ...store.editions.filter((other) => other.id !== edition.id)] });
    return { success: true, data: edition };
  }
  const { error } = await supabase.from(EDITIONS_TABLE).upsert(toEditionRow(edition), { onConflict: 'id' });
  return error === null ? { success: true, data: edition } : failed(error.message, error.code);
};

const sameSlot = (a: Edition, b: Edition): boolean => a.period === b.period && a.scope === b.scope && a.kind === b.kind;

/**
 * Publishes a draft: one update, which only reaches a row that is still a
 * draft. PostgREST reports a refused update as success with no rows, so the
 * row count is checked rather than trusted.
 */
export const publishEdition = async (published: Edition): Promise<Result<Edition>> => {
  if (published.status !== 'published' || published.content.snapshot === null) {
    return { success: false, error: 'Freeze the edition before publishing it.' };
  }
  const supabase = getSupabase();
  if (supabase === null) {
    const store = demoStore();
    writeDemo({ ...store, editions: [published, ...store.editions.filter((other) => other.id !== published.id)] });
    return { success: true, data: published };
  }
  const row = toEditionRow(published);
  const { data, error } = await supabase
    .from(EDITIONS_TABLE)
    .update({
      status: row.status,
      content: row.content,
      updated_by: row.updated_by,
      updated_at: row.updated_at,
      published_by: row.published_by,
      published_at: row.published_at,
    })
    .eq('id', published.id)
    .eq('status', 'draft')
    .select('id');
  if (error !== null) return failed(error.message, error.code);
  if ((data ?? []).length !== 1) return { success: false, error: 'It was not published. It may already be published, or you may not have access.' };
  return { success: true, data: published };
};

export const deleteDraft = async (edition: Edition): Promise<Result<true>> => {
  if (edition.status !== 'draft') return { success: false, error: 'A published edition stays in the archive.' };
  const supabase = getSupabase();
  if (supabase === null) {
    const store = demoStore();
    writeDemo({ ...store, editions: store.editions.filter((other) => other.id !== edition.id) });
    return { success: true, data: true };
  }
  const { error } = await supabase.from(EDITIONS_TABLE).delete().eq('id', edition.id).eq('status', 'draft');
  return error === null ? { success: true, data: true } : failed(error.message, error.code);
};

export const loadItems = async (): Promise<Result<readonly ScoreboardItem[]>> => {
  const supabase = getSupabase();
  if (supabase === null) return { success: true, data: demoStore().items };
  const { data, error } = await supabase
    .from(ITEMS_TABLE)
    .select('*')
    .eq('project_id', currentProject().id)
    .order('created_at', { ascending: true });
  if (error !== null) return failed(error.message, error.code);
  return { success: true, data: (data as ItemRow[]).map(fromItemRow) };
};

/** Records a stage change in the item's history, so the page can say it moved. */
export const withStage = (item: ScoreboardItem, stage: Stage, now: Date): ScoreboardItem =>
  item.stage === stage && item.history.length > 0
    ? item
    : { ...item, stage, history: [...item.history, { stage, at: now.toISOString() }] };

export const saveItem = async (item: ScoreboardItem): Promise<Result<ScoreboardItem>> => {
  const parsed = itemSchema.safeParse(item);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Check the item.' };
  const supabase = getSupabase();
  if (supabase === null) {
    const store = demoStore();
    const exists = store.items.some((other) => other.id === item.id);
    writeDemo({
      ...store,
      items: exists ? store.items.map((other) => (other.id === item.id ? item : other)) : [...store.items, item],
    });
    return { success: true, data: item };
  }
  const { error } = await supabase.from(ITEMS_TABLE).upsert(toItemRow(item), { onConflict: 'id' });
  return error === null ? { success: true, data: item } : failed(error.message, error.code);
};

export const deleteItem = async (id: string): Promise<Result<true>> => {
  const supabase = getSupabase();
  if (supabase === null) {
    const store = demoStore();
    writeDemo({ ...store, items: store.items.filter((item) => item.id !== id) });
    return { success: true, data: true };
  }
  const { error } = await supabase.from(ITEMS_TABLE).delete().eq('id', id);
  return error === null ? { success: true, data: true } : failed(error.message, error.code);
};

// ---------------------------------------------------------------------------
// The demonstration's example

const demoLanding = (): string =>
  typeof window === 'undefined'
    ? 'https://consultation.agaims.com.au/demo/#/landing'
    : `${window.location.origin}${import.meta.env.BASE_URL}#/landing`;

/**
 * What the demonstration site shows before anybody has written anything: one
 * published edition for last month, marked as invented, and the register
 * behind it. Built for the Potato Mech content in the scope document.
 */
export const demoSeed = (now: Date): DemoStore => {
  const period = addMonths(periodOf(now), -1);
  const at = (months: number): string => `${addMonths(period, months)}-15T00:00:00.000Z`;
  const item = (over: Partial<ScoreboardItem> & Pick<ScoreboardItem, 'id' | 'title' | 'stage'>): ScoreboardItem => ({
    scope: 'national',
    owner: 'Potato Mech',
    progress: '',
    nextMilestone: '',
    milestoneMonth: null,
    planRef: '',
    reason: '',
    themes: [],
    featured: false,
    history: [{ stage: over.stage, at: at(0) }],
    updatedBy: 'demo@example.invalid',
    updatedAt: at(0),
    ...over,
  });
  const items: ScoreboardItem[] = [
    item({ id: 'd0000000-0000-4000-8000-000000000001', title: 'Confirm the highest-value mechanisation questions for independent assessment', stage: 'listening', progress: 'Regional input is being reviewed against technical feasibility and potential impact.', nextMilestone: 'Priorities released', milestoneMonth: addMonths(period, 2), planRef: 'Milestone 102', themes: ['ROI'], featured: true }),
    item({ id: 'd0000000-0000-4000-8000-000000000002', title: 'Build a consistent technology evaluation framework', stage: 'scoped', history: [{ stage: 'listening', at: at(-1) }, { stage: 'scoped', at: at(0) }], progress: 'Draft measures include throughput, product damage, labour demand, operating cost and implementation risk.', nextMilestone: 'Review with growers and advisers', milestoneMonth: addMonths(period, 3), themes: ['ROI', 'Reliability'], featured: true }),
    item({ id: 'd0000000-0000-4000-8000-000000000003', title: 'Improve the regional relevance of PotatoLink activity', stage: 'underway', owner: 'PotatoLink Phase 2', progress: 'Regional topic profiles are being developed from consultation data.', nextMilestone: 'First district updates published', milestoneMonth: addMonths(period, 4), featured: true }),
    item({ id: 'd0000000-0000-4000-8000-000000000004', title: 'Provide a visible response to industry input', stage: 'underway', owner: 'Both projects', progress: 'This public scoreboard is now updated monthly.', nextMilestone: 'October edition published', milestoneMonth: addMonths(period, 1), featured: true }),
    item({ id: 'd0000000-0000-4000-8000-000000000005', title: 'Subsidies for buying new machinery', stage: 'not_taken_forward', owner: '', reason: 'Levy funds pay for research and extension, not for machinery purchases.' }),
    item({ id: 'd0000000-0000-4000-8000-000000000006', title: 'Labour hire rules for seasonal workers', stage: 'passed_on', owner: '', reason: 'Passed to the industry body that leads on workforce policy.', themes: ['Labour'] }),
  ];
  const draftOf = newEdition({ id: 'd0000000-0000-4000-8000-0000000000e1', period, scope: 'national', kind: 'monthly', previous: null, by: 'demo@example.invalid', now });
  const content: EditionContent = {
    ...draftOf.content,
    statement:
      'Contributors have highlighted labour, harvest quality, machinery reliability and the need for independent economic evidence as the strongest mechanisation themes so far. The project is now confirming regional priorities and designing the first commercial-scale evaluation activities.',
    blocks: { ...defaultBlocks(), timeline: true, register: true, asked: true },
    needYou: 'We are particularly seeking perspectives from Western Australia, seed growers, and growers who use contractors for harvest.',
    findings: [
      { id: 'f1', theme: 'Reliability', said: { kind: 'summary', text: 'Growers told us equipment has to work under Australian conditions, not just look good overseas.' }, heard: 'Local fit, including soil, irrigation layout, crop handling and serviceability, is central to adoption.', howWeKnow: '', regionsRaised: 5, regionsHeardFrom: 6 },
      { id: 'f2', theme: 'ROI', said: { kind: 'summary', text: 'Growers told us they need proof of payback before another capital investment.' }, heard: 'Independent data on labour, throughput, quality loss, operating cost and risk matters as much as the technology itself.', howWeKnow: 'The most common reason given for holding back', regionsRaised: 6, regionsHeardFrom: 6 },
    ],
    // The demonstration's own front page, so trying the example never sends
    // anybody into the live consultation counted as a scoreboard visitor.
    next: { headline: 'Have your say in the Potato Mechanisation consultation', buttonLabel: 'Take part', url: demoLanding() },
    asked: [{ question: 'Will the evaluation results be public?', answer: 'Yes. Every result will be published, including machines that did not perform.' }],
  };
  const numbers: Participation = {
    total: 148,
    online: 112,
    interviews: 14,
    workshops: 22,
    groupPeople: null,
    weekly: [
      { weekEnding: `${period}-07`, cumulative: 31 },
      { weekEnding: `${period}-14`, cumulative: 66 },
      { weekEnding: `${period}-21`, cumulative: 104 },
      { weekEnding: `${period}-28`, cumulative: 148 },
    ],
    regions: ['qld', 'wa', 'nsw', 'sa', 'ballarat', 'gippsland', 'tas'].map((id) => ({ id, heardFrom: id !== 'wa' })),
  };
  const published = freeze({ ...draftOf, content }, items, numbers, 'demo@example.invalid', new Date(`${addMonths(period, 1)}-01T00:00:00.000Z`));
  return { editions: [published], items };
};
