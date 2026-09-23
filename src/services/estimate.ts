import { allQuestions } from '../content/lookup';
import type { Question, Questionnaire, RoleId } from '../types';
import { shortVersion } from './formLength';

/**
 * How long a form takes to fill in, estimated from what it asks.
 *
 * Rough by nature, and deliberately pessimistic: a form that beats its
 * estimate costs nobody anything, while one that overruns loses the people it
 * most needs. The numbers come from watching the pilot — reading a prompt,
 * then the work of answering it, which is mostly about how many things there
 * are to read before choosing.
 */

const WORDS_PER_SECOND = 3.5;

const readingSeconds = (text: string | undefined): number =>
  text === undefined ? 0 : text.trim().split(/\s+/).filter(Boolean).length / WORDS_PER_SECOND;

/** Answering time, on a phone, once the question has been read. */
export const questionSeconds = (question: Question): number => {
  const reading = readingSeconds(question.prompt) + readingSeconds(question.help);
  switch (question.kind) {
    case 'multi':
      // Every option is read before the last tick is made.
      return reading + 6 + question.options.length * 1.6;
    case 'single':
      return reading + 4 + question.options.length * 1.4;
    case 'rank':
      // Picking an order means weighing the choices against each other.
      return reading + 10 + question.count * 6;
    case 'rating':
      // The slowest kind: a decision per row, and the scale re-read a few times.
      return reading + 6 + question.rows.length * 6;
    case 'text':
      // Typing on a phone, for somebody who has something to say.
      return reading + 45;
  }
};

/** The screens either side of the questions: who you are, and the optional contact step. */
const OVERHEAD_SECONDS = 70;

export interface Estimate {
  readonly seconds: number;
  readonly questions: number;
  /** Rounded up to the minute, as it is shown to a respondent. */
  readonly minutes: number;
}

const estimateOf = (questions: readonly Question[]): Estimate => {
  const seconds = questions.reduce((total, question) => total + questionSeconds(question), OVERHEAD_SECONDS);
  return { seconds: Math.round(seconds), questions: questions.length, minutes: Math.max(1, Math.ceil(seconds / 60)) };
};

/**
 * What one person is asked: the shared questions plus their own branch. A role
 * of null is somebody who has not said yet, so nothing branch-specific counts.
 */
export const questionsFor = (questionnaire: Questionnaire, role: RoleId | null): readonly Question[] => {
  const pathway = questionnaire.roles.find((entry) => entry.id === role)?.pathway ?? null;
  const branch = pathway === null ? undefined : questionnaire.pathways[pathway];
  return [
    ...questionnaire.core.flatMap((section) => section.questions),
    ...(branch?.questions ?? []),
    ...(questionnaire.stage === 'review' ? questionnaire.followUp.flatMap((section) => section.questions) : []),
    ...questionnaire.projectDesign.flatMap((section) => section.questions),
  ];
};

export const estimateFor = (questionnaire: Questionnaire, role: RoleId | null): Estimate =>
  estimateOf(questionsFor(questionnaire, role));

/** The branch that takes longest, because that is the one people abandon. */
export const longestEstimate = (
  questionnaire: Questionnaire,
): { readonly role: RoleId | null; readonly estimate: Estimate } => {
  const roles: readonly (RoleId | null)[] = [null, ...questionnaire.roles.map((role) => role.id)];
  return roles
    .map((role) => ({ role, estimate: estimateFor(questionnaire, role) }))
    .reduce((worst, candidate) => (candidate.estimate.seconds > worst.estimate.seconds ? candidate : worst));
};

export interface FormEstimates {
  readonly short: Estimate;
  readonly full: Estimate;
  readonly slowestRole: RoleId | null;
}

/** Both versions of the online form, for the branch that takes longest. */
export const formEstimates = (questionnaire: Questionnaire): FormEstimates => {
  const worst = longestEstimate(questionnaire);
  return {
    short: estimateFor(shortVersion(questionnaire), worst.role),
    full: worst.estimate,
    slowestRole: worst.role,
  };
};

/** "about 6 minutes", the way it is said to a respondent. */
export const spoken = (estimate: Estimate): string =>
  `about ${estimate.minutes} minute${estimate.minutes === 1 ? '' : 's'}`;

/** Where a form stops being something a busy person will finish. */
export const SHORT_TARGET_MINUTES = 5;
export const FULL_TARGET_MINUTES = 10;

export const allQuestionCount = (questionnaire: Questionnaire): number => allQuestions(questionnaire).length;
