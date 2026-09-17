import type { Question } from '../types';
import { allQuestions } from './lookup';
import { DEFAULT_QUESTIONNAIRE } from './questionnaire';

/**
 * The shared question library.
 *
 * A question's id is its identity across every project: `q1_constraints` in
 * one consultation means the same thing in the next, so results can be set
 * side by side. PT25003's questions are the library's first entries; a later
 * project picks from them, renames what it must through a round override, and
 * adds its own here — never by copying a question under a new id.
 */
export const QUESTION_LIBRARY: Readonly<Record<string, Question>> = Object.fromEntries(
  allQuestions(DEFAULT_QUESTIONNAIRE).map((question) => [question.id, question]),
);

export const libraryQuestion = (id: string): Question | undefined => QUESTION_LIBRARY[id];

export const libraryIds = (): readonly string[] => Object.keys(QUESTION_LIBRARY);
