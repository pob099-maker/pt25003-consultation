import type { Answer, AnswerMap, ConsultationResponse, Question, Questionnaire, RoleId, Section } from '../types';
import { questionSeconds } from './estimate';
import { shortVersion } from './formLength';
import { asksFollowUp } from './roundRules';
import { linkFor } from './sources';

/**
 * Bites: the short version, a minute or so at a time, one link each.
 *
 * A bite never words anything itself. It is a slice of the short version for
 * the person's own part of the industry: the same questions, the same ids, the
 * same options and scales, taken in the same order, so an answer given in a
 * bite is the same observation as one given in the short version. Put a
 * person's bites end to end and they are that person's short version. The
 * tests check exactly that, for every role in every kind of round, because it
 * is the whole reason bites can count towards the comparison at all.
 *
 * Two things are allowed and nothing else:
 * - A section is split between bites at a question boundary, except that a
 *   ranking stays with the tick list it ranks.
 * - A rating list too long for one bite is split by its rows. Each row is
 *   rated on its own, which is what already lets a watch list add a row in a
 *   later round without moving the others, so half a list is the same
 *   measurement for the rows it shows. The row somebody names for themselves
 *   goes with the last part.
 *
 * Bites are stored as ordinary responses with a marker answer, the way an
 * interview records its length, so they need no change to the database and go
 * through the same checks, outbox and insert rules as the online form. Every
 * screen that counts people leaves them out (see splitBites): seven bites from
 * one grower are seven rows, not seven growers.
 */

/** Stored with a bite's answers, naming the bite. Never a question. */
export const BITE_ID = 'bite__id';

/**
 * The longest a bite may run, by the same deliberately pessimistic estimate
 * the landing page uses. A single question longer than this still makes a bite
 * of its own: it cannot be cut without changing what it asks.
 */
export const BITE_SECONDS = 90;

export type BiteBlock = 'core' | 'pathway' | 'followUp' | 'projectDesign';

export interface Bite {
  /**
   * In the link and stored with the answers. A shared section's bite has the
   * same id for everybody. A role's own bites are numbered, pathway_1 and so
   * on, so one link can go to a whole chat group and open each person's own.
   */
  readonly id: string;
  readonly block: BiteBlock;
  readonly sectionId: string;
  /** The section's own title, as the short version shows it. */
  readonly title: string;
  readonly intro?: string;
  /** Which part of its section this is, from 1, and how many parts there are. */
  readonly part: number;
  readonly parts: number;
  /** The short version's own questions. A split rating list keeps all but its rows. */
  readonly questions: readonly Question[];
  readonly seconds: number;
}

type RatingQuestion = Extract<Question, { kind: 'rating' }>;

interface Unit {
  readonly questions: readonly Question[];
  readonly seconds: number;
}

const secondsOf = (questions: readonly Question[]): number =>
  questions.reduce((total, question) => total + questionSeconds(question), 0);

const unitOf = (questions: readonly Question[]): Unit => ({ questions, seconds: secondsOf(questions) });

/** Rows split into `count` runs as even as they can be, in their own order. */
const evenRuns = <T>(items: readonly T[], count: number): readonly (readonly T[])[] => {
  const runs: T[][] = [];
  let start = 0;
  for (let index = 0; index < count; index += 1) {
    const size = Math.floor(items.length / count) + (index < items.length % count ? 1 : 0);
    runs.push(items.slice(start, start + size));
    start += size;
  }
  return runs.filter((run) => run.length > 0);
};

/** A rating list cut into `count` runs of its rows. Only the last offers a row of their own. */
const splitRows = (question: RatingQuestion, count: number): readonly RatingQuestion[] => {
  const runs = evenRuns(question.rows, count);
  const { allowOther, ...rest } = question;
  return runs.map((rows, index) =>
    index === runs.length - 1 && allowOther !== undefined ? { ...rest, rows, allowOther } : { ...rest, rows },
  );
};

/** A rating list in the fewest row runs that each fit a bite, or whole if it already does. */
const ratingParts = (question: RatingQuestion): readonly Question[] => {
  if (questionSeconds(question) <= BITE_SECONDS) return [question];
  for (let count = 2; count < question.rows.length; count += 1) {
    const parts = splitRows(question, count);
    if (parts.every((part) => questionSeconds(part) <= BITE_SECONDS)) return parts;
  }
  return splitRows(question, question.rows.length);
};

/**
 * The pieces a section can be cut into: a question, a tick list with the
 * ranking drawn from it, or a run of a long rating list's rows.
 */
const unitsOf = (section: Section): readonly Unit[] => {
  const units: Question[][] = [];
  for (const question of section.questions) {
    if (question.kind === 'rank') {
      const source = units.find((unit) => unit.some((asked) => asked.id === question.sourceQuestionId));
      if (source !== undefined) {
        source.push(question);
        continue;
      }
    }
    if (question.kind === 'rating') {
      for (const part of ratingParts(question)) units.push([part]);
      continue;
    }
    units.push([question]);
  }
  return units.map(unitOf);
};

/**
 * Units in order, cut into the fewest bites that each fit, and of those cuts
 * the one whose longest bite is shortest, so a section in three parts is three
 * similar minutes rather than two long ones and a scrap.
 */
const pack = (units: readonly Unit[]): readonly (readonly Unit[])[] => {
  if (units.length === 0) return [];
  const best = new Map<string, { longest: number; cuts: readonly number[] }>();
  // The cheapest way to put units[from..] into `groups` bites.
  const solve = (from: number, groups: number): { longest: number; cuts: readonly number[] } => {
    const key = `${from}:${groups}`;
    const known = best.get(key);
    if (known !== undefined) return known;
    let result = { longest: Number.POSITIVE_INFINITY, cuts: [] as readonly number[] };
    if (groups === 1) {
      result = { longest: units.slice(from).reduce((sum, unit) => sum + unit.seconds, 0), cuts: [] };
    } else {
      for (let end = from + 1; end <= units.length - groups + 1; end += 1) {
        const head = units.slice(from, end).reduce((sum, unit) => sum + unit.seconds, 0);
        const rest = solve(end, groups - 1);
        const longest = Math.max(head, rest.longest);
        if (longest < result.longest) result = { longest, cuts: [end, ...rest.cuts] };
      }
    }
    best.set(key, result);
    return result;
  };
  const largest = Math.max(...units.map((unit) => unit.seconds));
  const limit = Math.max(BITE_SECONDS, largest);
  for (let groups = 1; groups <= units.length; groups += 1) {
    const found = solve(0, groups);
    if (found.longest <= limit) {
      const bounds = [0, ...found.cuts, units.length];
      return bounds.slice(1).map((end, index) => units.slice(bounds[index], end));
    }
  }
  return units.map((unit) => [unit]);
};

const bitesOfSection = (section: Section, block: BiteBlock, idOf: (part: number, parts: number) => string): readonly Bite[] => {
  const groups = pack(unitsOf(section));
  return groups.map((group, index) => {
    const questions = group.flatMap((unit) => unit.questions);
    return {
      id: idOf(index + 1, groups.length),
      block,
      sectionId: section.id,
      title: section.title,
      ...(section.intro === undefined ? {} : { intro: section.intro }),
      part: index + 1,
      parts: groups.length,
      questions,
      seconds: Math.round(secondsOf(questions)),
    };
  });
};

const sectionIds =
  (section: Section) =>
  (part: number, parts: number): string =>
    parts === 1 ? section.id : `${section.id}_${part}`;

/** The pathway one role is asked, if the questionnaire has one for it. */
export const pathwayFor = (questionnaire: Questionnaire, role: RoleId | null): string | null => {
  const pathway = questionnaire.roles.find((entry) => entry.id === role)?.pathway ?? null;
  return pathway !== null && questionnaire.pathways[pathway] !== undefined ? pathway : null;
};

/**
 * One person's bites, in order: the shared sections, their own part of the
 * industry, what they saw and changed when the round asks it, and the code for
 * next time. A role of null gets the shared ones only, as the short version
 * would ask before somebody has said who they are.
 */
export const bitesFor = (questionnaire: Questionnaire, role: RoleId | null): readonly Bite[] => {
  const short = shortVersion(questionnaire);
  const pathway = pathwayFor(short, role);
  const own = pathway === null ? undefined : short.pathways[pathway];
  return [
    ...short.core.flatMap((section) => bitesOfSection(section, 'core', sectionIds(section))),
    ...(own === undefined ? [] : bitesOfSection(own, 'pathway', (part) => `pathway_${part}`)),
    ...(asksFollowUp(short.stage)
      ? short.followUp.flatMap((section) => bitesOfSection(section, 'followUp', sectionIds(section)))
      : []),
    ...short.projectDesign.flatMap((section) => bitesOfSection(section, 'projectDesign', sectionIds(section))),
  ];
};

/** The bite a link names, for this person. Null when their part of the industry has no such bite. */
export const biteFor = (questionnaire: Questionnaire, role: RoleId | null, id: string): Bite | null =>
  bitesFor(questionnaire, role).find((bite) => bite.id === id) ?? null;

/** The first of this person's bites they have not sent from this phone. */
export const nextBite = (
  questionnaire: Questionnaire,
  role: RoleId | null,
  done: readonly string[],
): Bite | null => bitesFor(questionnaire, role).find((bite) => !done.includes(bite.id)) ?? null;

/**
 * One link, as the admin screen lists it. A shared section's link asks
 * everybody the same thing. A pathway link asks each part of the industry its
 * own, and some parts have fewer of them, or none.
 */
export interface BiteSlot {
  readonly id: string;
  readonly block: BiteBlock;
  /** What it asks, for each pathway it asks anything of. One entry for a shared bite. */
  readonly asks: readonly {
    readonly pathway: string | null;
    readonly roles: readonly RoleId[];
    readonly bite: Bite;
  }[];
  /** Roles it asks nothing of. Only ever a pathway bite. */
  readonly nothingFor: readonly RoleId[];
}

export const biteSlots = (questionnaire: Questionnaire): readonly BiteSlot[] => {
  const shared = bitesFor(questionnaire, null).filter((bite) => bite.block !== 'pathway');
  const roles = questionnaire.roles.map((role) => role.id);
  const byPathway = new Map<string, { roles: RoleId[]; bites: readonly Bite[] }>();
  const without: RoleId[] = [];
  for (const role of roles) {
    const pathway = pathwayFor(questionnaire, role);
    const own = bitesFor(questionnaire, role).filter((bite) => bite.block === 'pathway');
    if (pathway === null || own.length === 0) {
      without.push(role);
      continue;
    }
    const entry = byPathway.get(pathway) ?? { roles: [], bites: own };
    entry.roles.push(role);
    byPathway.set(pathway, entry);
  }
  const most = Math.max(0, ...[...byPathway.values()].map((entry) => entry.bites.length));
  const pathwaySlots: BiteSlot[] = [];
  for (let part = 1; part <= most; part += 1) {
    const asks = [...byPathway.entries()].flatMap(([pathway, entry]) => {
      const bite = entry.bites[part - 1];
      return bite === undefined ? [] : [{ pathway, roles: entry.roles, bite }];
    });
    const asked = new Set(asks.flatMap((ask) => ask.roles));
    pathwaySlots.push({
      id: `pathway_${part}`,
      block: 'pathway',
      asks,
      nothingFor: roles.filter((role) => !asked.has(role)),
    });
  }
  const sharedSlot = (bite: Bite): BiteSlot => ({
    id: bite.id,
    block: bite.block,
    asks: [{ pathway: null, roles, bite }],
    nothingFor: [],
  });
  const before = shared.filter((bite) => bite.block === 'core').map(sharedSlot);
  const after = shared.filter((bite) => bite.block !== 'core').map(sharedSlot);
  return [...before, ...pathwaySlots, ...after];
};

export const biteAnswer = (id: string): Answer => ({ kind: 'single', value: id });

/** Which bite an answer set came from, or null for a whole one. */
export const biteOf = (answers: AnswerMap): string | null => {
  const answer = answers[BITE_ID];
  return answer?.kind === 'single' && answer.value.length > 0 ? answer.value : null;
};

export const isBite = (response: ConsultationResponse): boolean => biteOf(response.answers) !== null;

/**
 * Whole answer sets on one side, bites on the other. Everything that counts
 * people — how many responded, by role and area, how long it took, how far
 * people got, which link brought them — reads the first list only, exactly as
 * it did before bites existed. Bites are read question by question, on their
 * own screen, where a row is an answer and never a person.
 */
export const splitBites = (
  responses: readonly ConsultationResponse[],
): { readonly whole: readonly ConsultationResponse[]; readonly bites: readonly ConsultationResponse[] } => ({
  whole: responses.filter((response) => !isBite(response)),
  bites: responses.filter(isBite),
});

/**
 * The link for one bite, labelled with the channel it goes out by. The label
 * names a channel from the fixed list, never a person, as for every link.
 */
export const biteLink = (origin: string, biteId: string, source: string, base = '/'): string =>
  `${linkFor(origin, source, base)}#/b/${biteId}`;

/** "about 40 seconds", "about a minute", rounded the way it is said aloud. */
export const biteTime = (seconds: number): string => {
  if (seconds < 50) return `about ${Math.max(10, Math.round(seconds / 10) * 10)} seconds`;
  if (seconds < 75) return 'about a minute';
  if (seconds < 105) return 'about a minute and a half';
  return `about ${Math.round(seconds / 60)} minutes`;
};

/** What a person sees as the bite's name: its section, and the part when there are several. */
export const biteTitle = (bite: Bite): string =>
  bite.parts === 1 ? bite.title : `${bite.title}, part ${bite.part} of ${bite.parts}`;
