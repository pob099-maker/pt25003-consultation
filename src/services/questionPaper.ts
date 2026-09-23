import { allQuestions } from '../content/lookup';
import type { Option, Question, Questionnaire, ScalePoint } from '../types';
import { formEstimates } from './estimate';
import { shortVersion } from './formLength';

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
      return `Each line rated ${question.scale[0]?.value ?? 1} to ${question.scale.at(-1)?.value ?? 5}`;
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
      return question.rows;
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

const EVERYBODY = 'Everybody';

export const buildQuestionPaper = (questionnaire: Questionnaire): QuestionPaper => {
  const shortIds = new Set(allQuestions(shortVersion(questionnaire)).map((question) => question.id));
  const sections: PaperSection[] = [];
  let number = 0;

  /** `always` is for the screens outside the question sections: everybody gets them, both versions. */
  const add = (
    id: string,
    title: string,
    audience: string,
    questions: readonly Question[],
    intro?: string,
    always = false,
  ): void => {
    if (questions.length === 0) return;
    sections.push({
      id,
      title,
      audience,
      ...(intro === undefined ? {} : { intro }),
      questions: questions.map((question) => {
        number += 1;
        return toPaperQuestion(question, number, always || shortIds.has(question.id), questionnaire, {
          title,
          audience,
        });
      }),
    });
  };

  // Role and region are asked on their own screen rather than as questions in
  // a section, and a paper that left them out would not be the questionnaire.
  const aboutYou: readonly Question[] = [
    {
      id: 'role',
      kind: 'single',
      prompt: 'Which of these best describes you?',
      help: 'This decides which questions you are asked next.',
      required: true,
      options: questionnaire.roles,
    },
    {
      id: 'regions',
      kind: 'multi',
      prompt: 'Which regions do you work in?',
      allowOther: true,
      options: questionnaire.regions,
    },
  ];
  add('about-you', 'About you', EVERYBODY, aboutYou, undefined, true);

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
  return {
    roundLabel: questionnaire.roundLabel,
    sections,
    shortCount: asked.filter((question) => question.inShort).length,
    fullCount: asked.length,
    shortMinutes: estimates.short.minutes,
    fullMinutes: estimates.full.minutes,
    slowestRole,
    shortList: asked.filter((question) => question.inShort),
  };
};
