import type { Answer, AnswerMap, Questionnaire, Section } from '../types';

/**
 * A short version asks only the tracked questions — the ones repeated word for
 * word at baseline, mid-project and end — so a few minutes from a busy grower still
 * counts towards the comparison that matters most. Question ids are unchanged,
 * so somebody can switch to the full version half-way and keep every answer.
 */
export type FormLength = 'full' | 'short';

export const LENGTH_ID = 'interview__length';

const trackedOnly = (section: Section): Section => ({
  ...section,
  questions: section.questions.filter((question) => question.tracking === true),
});

const hasQuestions = (section: Section): boolean => section.questions.length > 0;

export const shortVersion = (questionnaire: Questionnaire): Questionnaire => ({
  ...questionnaire,
  core: questionnaire.core.map(trackedOnly).filter(hasQuestions),
  followUp: questionnaire.followUp.map(trackedOnly).filter(hasQuestions),
  projectDesign: questionnaire.projectDesign.map(trackedOnly).filter(hasQuestions),
  pathways: Object.fromEntries(
    Object.entries(questionnaire.pathways)
      .map(([key, section]) => [key, trackedOnly(section)] as const)
      .filter(([, section]) => hasQuestions(section)),
  ),
});

/** Recorded with the response, so analysis can tell a short call from a full one. */
export const lengthAnswer = (length: FormLength): Answer => ({ kind: 'single', value: length });

export const lengthOf = (answers: AnswerMap): FormLength | null => {
  const answer = answers[LENGTH_ID];
  return answer?.kind === 'single' && (answer.value === 'full' || answer.value === 'short') ? answer.value : null;
};
