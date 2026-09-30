import { optionLabel, questionById } from './lookup';
import type { AnswerMap, Option, Question, Questionnaire } from '../types';

/**
 * Questions whose wording or choices depend on an earlier answer. Kept in one
 * place so the online form and the interviewer screen cannot drift apart on
 * what a question says.
 */

/** Question 2 ranks only what the person named in question 1. */
export const rankChoicesFor = (questionnaire: Questionnaire, answers: AnswerMap): readonly Option[] => {
  const source = questionById(questionnaire, 'q1_constraints');
  if (source === undefined || source.kind !== 'multi') return [];
  const answer = answers['q1_constraints'];
  if (answer === undefined || answer.kind !== 'multi') return [];
  return source.options.filter((option) => answer.values.includes(option.id));
};

/**
 * Question 3 asks about "the one at the top of your list". We know which one
 * that is, so say it — nobody should have to scroll back, or be read back to,
 * to work out what they are answering about.
 */
export const topConstraintLabel = (questionnaire: Questionnaire, answers: AnswerMap): string | undefined => {
  const ranked = answers['q2_top_three'];
  const top = ranked !== undefined && ranked.kind === 'rank' ? ranked.values[0] : undefined;
  if (top === undefined) return undefined;
  return optionLabel(questionById(questionnaire, 'q1_constraints'), top).toLowerCase();
};

/**
 * Answers to question 3 that would only name the top problem again, by the
 * problem's id in question 1. The others are all costs, which every problem
 * can have; these two are the same thing said twice, and ticked, they say
 * nothing.
 */
const RESTATES: Readonly<Record<string, readonly string[]>> = {
  skills: ['labour_avail'],
};

/** Question 3's choices for this person, when they differ from the full list. */
export const choicesFor = (question: Question, answers: AnswerMap): readonly Option[] | undefined => {
  if (question.id !== 'q3_impact' || question.kind !== 'multi') return undefined;
  const ranked = answers['q2_top_three'];
  const top = ranked !== undefined && ranked.kind === 'rank' ? ranked.values[0] : undefined;
  const leaveOut = top === undefined ? undefined : RESTATES[top];
  if (leaveOut === undefined) return undefined;
  return question.options.filter((option) => !leaveOut.includes(option.id));
};

export const promptOverrideFor = (
  questionnaire: Questionnaire,
  question: Question,
  answers: AnswerMap,
): string | undefined => {
  if (question.id !== 'q3_impact') return undefined;
  const top = topConstraintLabel(questionnaire, answers);
  return top === undefined ? undefined : `Thinking about ${top} — what does it actually cost a business?`;
};

/** The interviewer's version of the same thing, said aloud. */
export const guideOverrideFor = (
  questionnaire: Questionnaire,
  question: Question,
  answers: AnswerMap,
): string | undefined => {
  if (question.id !== 'q3_impact') return undefined;
  const top = topConstraintLabel(questionnaire, answers);
  return top === undefined ? undefined : `When ${top} goes wrong, what does it actually cost?`;
};
