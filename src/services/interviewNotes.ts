import { allSections } from '../content/lookup';
import type { Answer, AnswerMap, Questionnaire, Section } from '../types';

/**
 * Things an interviewer keeps that are not answers to a question: running
 * notes and quotes, filed under the section they came up in, and which
 * questions were answered from something said earlier rather than asked.
 *
 * They travel inside the response's answers, under ids no question can have,
 * so they need no new column and reach the comments tab and the export with
 * everything else.
 */

const NOTE_PREFIX = 'note__';
export const COVERED_ID = 'interview__covered';

export const noteId = (sectionId: string): string => `${NOTE_PREFIX}${sectionId}`;

export const isNoteId = (id: string): boolean => id.startsWith(NOTE_PREFIX);

/** Notes taken before a role or section was chosen go here. */
export const GENERAL_NOTES = 'general';

export const noteLabel = (questionnaire: Questionnaire, id: string): string => {
  const sectionId = id.slice(NOTE_PREFIX.length);
  if (sectionId === GENERAL_NOTES || sectionId === 'about_you') return 'Interview notes';
  const section = allSections(questionnaire).find((candidate) => candidate.id === sectionId);
  return `Interview notes — ${section?.title ?? sectionId}`;
};

export const coveredEarlier = (answers: AnswerMap): readonly string[] => {
  const covered = answers[COVERED_ID];
  return covered?.kind === 'multi' ? covered.values : [];
};

/** Adds or removes a question from the "came up earlier" list; undefined clears the entry. */
export const toggleCovered = (answers: AnswerMap, questionId: string): Answer | undefined => {
  const current = coveredEarlier(answers);
  const next = current.includes(questionId) ? current.filter((id) => id !== questionId) : [...current, questionId];
  return next.length === 0 ? undefined : { kind: 'multi', values: next };
};

/** Every note in a response, labelled, for the export. */
export const notesText = (questionnaire: Questionnaire, answers: AnswerMap): string =>
  Object.entries(answers)
    .filter(([id, answer]) => isNoteId(id) && answer.kind === 'text' && answer.value.trim().length > 0)
    .map(([id, answer]) => `${noteLabel(questionnaire, id)}: ${answer.kind === 'text' ? answer.value.trim() : ''}`)
    .join(' | ');

export type SectionStatus = 'current' | 'done' | 'started' | 'untouched';

/**
 * How far a section has got: every question answered, some, or none. A
 * question marked as covered earlier counts once it has an answer, like any
 * other.
 */
export const sectionStatus = (section: Section | null, answers: AnswerMap, done: boolean): SectionStatus => {
  if (section === null) return done ? 'done' : 'untouched';
  const answered = section.questions.filter((question) => answers[question.id] !== undefined).length;
  const noted = (answers[noteId(section.id)]?.kind ?? '') === 'text';
  if (answered === 0) return noted ? 'started' : 'untouched';
  return answered === section.questions.length ? 'done' : 'started';
};
