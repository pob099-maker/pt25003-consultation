import type { Question, Questionnaire, ScalePoint, Section } from '../types';
import { CALLBACK_INTEREST_ID, CALLBACK_INTEREST_LABEL } from '../services/callback';
import { LINK_CODE_ID } from '../services/linkCode';
import { KEEP_IN_TOUCH_ID, KEEP_IN_TOUCH_LABEL } from './questionnaire';

/**
 * The row somebody names for themselves at the foot of a rating question that
 * allows it. Its step is stored under this id and what they wrote beside it.
 */
export const OTHER_ROW = 'other';
export const OTHER_ROW_LABEL = 'Something else';

/**
 * What a question, option or row id may look like when it is read back from
 * storage: lower-case letters, digits and underscores, starting with a letter
 * or a digit, and never a name every object already carries. Anybody can
 * insert a row with the public key, and a row keyed "constructor" would read
 * back as a function in every other respondent's column.
 */
const SAFE_ID = /^[a-z0-9][a-z0-9_]{0,79}$/;
const RESERVED_IDS: ReadonlySet<string> = new Set(['constructor']);
export const isSafeId = (id: string): boolean => SAFE_ID.test(id) && !RESERVED_IDS.has(id);

/**
 * The ordered steps of a scale, without an answer that sits beside it such as
 * "tried it and stopped". Only these are averaged or charted as a spread.
 */
export const onScale = (scale: readonly ScalePoint[]): readonly ScalePoint[] =>
  scale.filter((point) => point.offScale !== true);

/** Whether a stored rating is one of the ordered steps of its question's scale. */
export const isOnScaleValue = (question: Question | undefined, value: number): boolean =>
  question?.kind !== 'rating' || !question.scale.some((point) => point.offScale === true && point.value === value);

/**
 * The anonymous follow-up code, recognised the one way everywhere: by its id,
 * or by being entered as a code. Two markers kept separately drift apart, and
 * a code question that one screen misses is one that gets typed freely and
 * then refused by the schema.
 */
export const isLinkCodeQuestion = (question: Question): boolean =>
  question.id === LINK_CODE_ID || (question.kind === 'text' && question.entry === 'linkCode');

/**
 * Questions one person answers about themselves: the follow-up code. Never put
 * to a room, and never "must ask".
 */
export const isPersonalQuestion = (question: Question): boolean => isLinkCodeQuestion(question);

export const allSections = (questionnaire: Questionnaire): readonly Section[] => [
  ...questionnaire.core,
  ...Object.values(questionnaire.pathways),
  ...questionnaire.followUp,
  ...questionnaire.projectDesign,
];

/** The questions asked identically every round, for the change-over-time view. */
export const trackingQuestions = (questionnaire: Questionnaire): readonly Question[] =>
  allQuestions(questionnaire).filter((question) => question.tracking === true);

export const allQuestions = (questionnaire: Questionnaire): readonly Question[] =>
  allSections(questionnaire).flatMap((section) => section.questions);

export const questionById = (questionnaire: Questionnaire, id: string): Question | undefined =>
  allQuestions(questionnaire).find((question) => question.id === id);

/** Option label for a question's choice id, falling back to the raw id. */
export const optionLabel = (question: Question | undefined, optionId: string): string => {
  if (question === undefined) return optionId;
  if (question.kind === 'multi' || question.kind === 'single') {
    return question.options.find((option) => option.id === optionId)?.label ?? optionId;
  }
  if (question.kind === 'rating') {
    if (optionId === OTHER_ROW && question.allowOther === true) return OTHER_ROW_LABEL;
    return question.rows.find((row) => row.id === optionId)?.label ?? optionId;
  }
  if (question.kind === 'rank') {
    return question.fallbackOptions.find((option) => option.id === optionId)?.label ?? optionId;
  }
  return optionId;
};

export const regionLabel = (questionnaire: Questionnaire, id: string): string =>
  questionnaire.regions.find((region) => region.id === id)?.label ?? id;

export const roleLabel = (questionnaire: Questionnaire, id: string | null): string =>
  id === null ? 'Not given' : (questionnaire.roles.find((role) => role.id === id)?.label ?? id);

/** Looks through the common list and every pathway's, so an export reads the
 * same whichever perspective the person came through. */
export const interestLabel = (questionnaire: Questionnaire, id: string): string => {
  if (id === 'none') return 'None of these';
  // Not one of the questionnaire's options: it is how somebody asked to be
  // rung rather than something they volunteered for.
  if (id === CALLBACK_INTEREST_ID) return CALLBACK_INTEREST_LABEL;
  if (id === KEEP_IN_TOUCH_ID) return KEEP_IN_TOUCH_LABEL;
  const common = questionnaire.interestOptions.find((option) => option.id === id);
  if (common !== undefined) return common.label;
  for (const options of Object.values(questionnaire.pathwayInterests)) {
    const match = options.find((option) => option.id === id);
    if (match !== undefined) return match.label;
  }
  return id;
};
