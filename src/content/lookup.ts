import type { Question, Questionnaire, Section } from '../types';

export const allSections = (questionnaire: Questionnaire): readonly Section[] => [
  ...questionnaire.core,
  ...Object.values(questionnaire.pathways),
  ...questionnaire.projectDesign,
];

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

export const interestLabel = (questionnaire: Questionnaire, id: string): string =>
  questionnaire.interestOptions.find((option) => option.id === id)?.label ?? id;
