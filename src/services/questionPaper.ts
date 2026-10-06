import { OTHER_ROW, OTHER_ROW_LABEL, allQuestions } from '../content/lookup';
import { ABOUT_YOU } from '../content/questionnaire';
import type { Option, Question, Questionnaire, ScalePoint } from '../types';
import { formEstimates } from './estimate';
import { shortVersion } from './formLength';
import { isWatchList } from './roundRules';

/**
 * The whole questionnaire as a document somebody can read on paper.
 *
 * Every other view of the questions is partial on purpose: the form shows one
 * branch, the phone script is written to be read aloud, the editor shows one
 * question at a time. None of them answers "what exactly are we asking?",
 * which is the question a colleague, a reference group or a funder asks, and
 * the one people answer today by scrolling through source code.
 *
 * Built from the questionnaire that is live now, so it cannot describe last
 * month's wording, and it says which questions the short version asks by
 * deriving them rather than restating the rule.
 */

/**
 * Whether the team can change a question, in the words the wording tab uses.
 * Tracked questions are asked word for word every round, so the starting point
 * compares with each review; a watch list keeps its words but can gain lines.
 */
export type PaperStatus = 'locked' | 'list' | 'open';

export const STATUS_LABEL: Readonly<Record<PaperStatus, string>> = {
  locked: 'Tracked · locked',
  list: 'Tracked · you can add to this list',
  open: 'Can be reworded',
};

export const STATUS_HELP: Readonly<Record<PaperStatus, string>> = {
  locked:
    'Asked word for word in every round, so the starting point can be compared with each review. It cannot be changed on the wording tab. Changing one means changing the questionnaire itself, and only before anybody has answered.',
  list: 'The question and its lines keep their words, but a line can be added or stopped between rounds as the project takes on new technology.',
  open: 'Can be changed on the Question wording tab at any time. New responses use the new wording from then on.',
};

const statusOf = (question: Question): PaperStatus =>
  question.tracking === true ? (isWatchList(question) ? 'list' : 'locked') : 'open';

export interface PaperQuestion {
  /** Continuous through the paper, for pointing at in a meeting. Nobody answering sees a number. */
  readonly number: number;
  readonly id: string;
  readonly prompt: string;
  readonly help?: string;
  readonly kindLabel: string;
  readonly options: readonly Option[];
  readonly scale?: readonly ScalePoint[];
  /** Anything about the question that the options alone do not say. */
  readonly notes: readonly string[];
  readonly inShort: boolean;
  readonly required: boolean;
  /** Whether the team can change it, and how. */
  readonly status: PaperStatus;
  /** The section it belongs to, so a list of questions out of context still says who is asked. */
  readonly sectionTitle: string;
  readonly audience: string;
}

export interface PaperSection {
  readonly id: string;
  readonly title: string;
  readonly intro?: string;
  /** Who is asked this section. */
  readonly audience: string;
  readonly questions: readonly PaperQuestion[];
}

export interface QuestionPaper {
  readonly roundLabel: string;
  readonly sections: readonly PaperSection[];
  readonly shortCount: number;
  readonly fullCount: number;
  readonly shortMinutes: number;
  readonly fullMinutes: number;
  /** The branch the estimates are for: the longest one, which is the one people abandon. */
  readonly slowestRole: string;
  /** The short version in order, prompts only. */
  readonly shortList: readonly PaperQuestion[];
}

/**
 * What kind of answer it takes, said about the question rather than to the
 * reader. A question's own help often starts "Tick as many as you like", and
 * two instructions in a row read as a mistake.
 */
const kindLabel = (question: Question): string => {
  switch (question.kind) {
    case 'multi':
      return question.allowOther === true ? "Any number of answers, plus an 'other' box" : 'Any number of answers';
    case 'single':
      return 'One answer only';
    case 'text':
      return 'Written answer';
    case 'rating':
      return `Each line rated ${question.scale[0]?.value ?? 1} to ${question.scale.at(-1)?.value ?? 5}${
        question.allowOther === true ? ', plus a line to write in' : ''
      }`;
    case 'rank':
      return `${question.count} of them, in order`;
  }
};

const optionsOf = (question: Question): readonly Option[] => {
  switch (question.kind) {
    case 'multi':
    case 'single':
      return question.options;
    case 'rating':
      return question.allowOther === true
        ? [...question.rows, { id: OTHER_ROW, label: `${OTHER_ROW_LABEL}: they write what it is` }]
        : question.rows;
    case 'rank':
      return question.fallbackOptions;
    case 'text':
      return [];
  }
};

const notesOf = (question: Question, questionnaire: Questionnaire): readonly string[] => {
  const notes: string[] = [];
  if (question.kind === 'rank') {
    const source = allQuestions(questionnaire).find((candidate) => candidate.id === question.sourceQuestionId);
    notes.push(
      `The choices are whatever was ticked in "${source?.prompt ?? question.sourceQuestionId}". Somebody who ticked nothing is offered the list below.`,
    );
  }
  if (question.kind === 'text' && question.entry === 'linkCode') {
    notes.push(
      'Asked as three short answers that the form puts together: two letters, a day of the month, two letters. Optional.',
    );
  }
  if (question.kind === 'rating' && question.openRows === true) {
    notes.push('The project can add lines to this list in later rounds, as new technology turns up.');
  }
  if (question.kind === 'text' && question.placeholder !== undefined) {
    notes.push(`Grey prompt in the box: "${question.placeholder}"`);
  }
  return notes;
};

const toPaperQuestion = (
  question: Question,
  number: number,
  inShort: boolean,
  questionnaire: Questionnaire,
  section: { readonly title: string; readonly audience: string },
  status: PaperStatus,
): PaperQuestion => ({
  number,
  id: question.id,
  prompt: question.prompt,
  ...(question.help === undefined ? {} : { help: question.help }),
  kindLabel: kindLabel(question),
  options: optionsOf(question),
  ...(question.kind === 'rating' ? { scale: question.scale } : {}),
  notes: notesOf(question, questionnaire),
  inShort,
  required: question.required === true,
  status,
  sectionTitle: section.title,
  audience: section.audience,
});

/** "Growers and farm managers", from the roles that lead to a branch. */
const audienceFor = (questionnaire: Questionnaire, pathway: string): string => {
  const roles = questionnaire.roles.filter((role) => role.pathway === pathway).map((role) => role.label);
  if (roles.length === 0) return 'Nobody: no role leads here';
  if (roles.length === 1) return roles[0] as string;
  return `${roles.slice(0, -1).join(', ')} and ${roles.at(-1) as string}`;
};

export const EVERYBODY = 'Everybody';

export const buildQuestionPaper = (questionnaire: Questionnaire): QuestionPaper => {
  // Role and region are asked in both versions, and shortVersion() cannot say
  // so because they are not questions in any section.
  const shortIds = new Set([
    ...allQuestions(shortVersion(questionnaire)).map((question) => question.id),
    'role',
    'regions',
  ]);
  const sections: PaperSection[] = [];
  let number = 0;

  const add = (
    id: string,
    title: string,
    audience: string,
    questions: readonly Question[],
    intro?: string,
  ): void => {
    if (questions.length === 0) return;
    sections.push({
      id,
      title,
      audience,
      ...(intro === undefined ? {} : { intro }),
      questions: questions.map((question) => {
        number += 1;
        // Role and region are not on the wording tab at all: who answered is how
        // one round is compared with the next, so they hold still like a tracked question.
        const status = id === 'about-you' ? 'locked' : statusOf(question);
        return toPaperQuestion(question, number, shortIds.has(question.id), questionnaire, { title, audience }, status);
      }),
    });
  };

  // Role and region are asked on their own screen rather than as questions in
  // a section, and a paper that left them out would not be the questionnaire.
  const aboutYou: readonly Question[] = [
    {
      id: 'role',
      kind: 'single',
      prompt: ABOUT_YOU.role.prompt,
      help: ABOUT_YOU.role.help,
      required: true,
      options: questionnaire.roles,
    },
    {
      id: 'regions',
      kind: 'multi',
      prompt: ABOUT_YOU.regions.prompt,
      help: ABOUT_YOU.regions.help,
      allowOther: true,
      options: questionnaire.regions,
    },
  ];
  add('about-you', 'About you', EVERYBODY, aboutYou);

  for (const section of questionnaire.core) {
    add(section.id, section.title, EVERYBODY, section.questions, section.intro);
  }

  for (const [pathway, section] of Object.entries(questionnaire.pathways)) {
    add(section.id, section.title, audienceFor(questionnaire, pathway), section.questions, section.intro);
  }

  for (const section of questionnaire.followUp) {
    add(
      section.id,
      section.title,
      'Everybody, in a review consultation only',
      section.questions,
      section.intro ?? 'Not asked at the starting point: there is nothing yet to have seen or changed.',
    );
  }

  for (const section of questionnaire.projectDesign) {
    add(section.id, section.title, EVERYBODY, section.questions, section.intro);
  }

  const estimates = formEstimates(questionnaire);
  const slowestRole =
    questionnaire.roles.find((role) => role.id === estimates.slowestRole)?.label ?? 'somebody who gave no role';

  const asked = sections.flatMap((section) => section.questions);
  const shortList = asked.filter((question) => question.inShort);
  return {
    roundLabel: questionnaire.roundLabel,
    sections,
    shortCount: shortList.length,
    fullCount: asked.length,
    shortMinutes: estimates.short.minutes,
    fullMinutes: estimates.full.minutes,
    slowestRole,
    shortList,
  };
};

/**
 * Each question's number on the paper, so every other screen can point at the
 * same question with the same number. A question the round does not ask has none.
 */
export const paperNumbers = (questionnaire: Questionnaire): ReadonlyMap<string, number> =>
  new Map(
    buildQuestionPaper(questionnaire).sections.flatMap((section) =>
      section.questions.map((question) => [question.id, question.number] as const),
    ),
  );
