import {
  OTHER_ROW,
  OTHER_ROW_LABEL,
  QUOTE_OK_ID,
  isLinkCodeQuestion,
  isPersonalQuestion,
  optionLabel,
  questionById,
} from '../content/lookup';
import { isNoteId, noteLabel } from './interviewNotes';
import { lengthOf } from './formLength';
import type { ConsultationResponse, Questionnaire } from '../types';

export interface Tally {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  /** Share of the responses that had anything to say about this question. */
  readonly share: number;
}

export interface RankedConstraint extends Tally {
  /** 3 points for a first choice, 2 for a second, 1 for a third. */
  readonly weightedScore: number;
  readonly firstChoices: number;
}

export interface RatedArea {
  readonly id: string;
  readonly label: string;
  readonly mean: number;
  readonly responses: number;
  /** Share rating the area 4 or 5. */
  readonly highPriorityShare: number;
  /** How many gave each score, 1 to 5. */
  readonly scores: readonly number[];
}

const round = (value: number, places = 2): number => Number(value.toFixed(places));

export const tallyMulti = (
  questionnaire: Questionnaire,
  responses: readonly ConsultationResponse[],
  questionId: string,
): readonly Tally[] => {
  const question = questionById(questionnaire, questionId);
  const counts = new Map<string, number>();
  let answered = 0;
  for (const response of responses) {
    const answer = response.answers[questionId];
    if (answer === undefined || answer.kind !== 'multi' || answer.values.length === 0) continue;
    answered += 1;
    for (const value of answer.values) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({
      id,
      label: optionLabel(question, id),
      count,
      share: answered === 0 ? 0 : round(count / answered),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
};

/**
 * Ranked priorities. A weighted score reflects the order people put things in;
 * first choices are reported alongside it because a constraint that many people
 * put second is a different finding from one a few people put first.
 */
export const rankConstraints = (
  questionnaire: Questionnaire,
  responses: readonly ConsultationResponse[],
  questionId: string,
): readonly RankedConstraint[] => {
  const question = questionById(questionnaire, questionId);
  const scores = new Map<string, { score: number; count: number; first: number }>();
  let answered = 0;
  for (const response of responses) {
    const answer = response.answers[questionId];
    if (answer === undefined || answer.kind !== 'rank' || answer.values.length === 0) continue;
    answered += 1;
    answer.values.forEach((id, index) => {
      const weight = Math.max(3 - index, 1);
      const current = scores.get(id) ?? { score: 0, count: 0, first: 0 };
      scores.set(id, {
        score: current.score + weight,
        count: current.count + 1,
        first: current.first + (index === 0 ? 1 : 0),
      });
    });
  }
  return [...scores.entries()]
    .map(([id, value]) => ({
      id,
      label: optionLabel(question, id),
      count: value.count,
      share: answered === 0 ? 0 : round(value.count / answered),
      weightedScore: value.score,
      firstChoices: value.first,
    }))
    .sort((a, b) => b.weightedScore - a.weightedScore || b.firstChoices - a.firstChoices);
};

export const rateAreas = (
  questionnaire: Questionnaire,
  responses: readonly ConsultationResponse[],
  questionId: string,
): readonly RatedArea[] => {
  const question = questionById(questionnaire, questionId);
  const rows = question !== undefined && question.kind === 'rating' ? question.rows : [];
  return rows
    .map((row) => {
      const values: number[] = [];
      for (const response of responses) {
        const answer = response.answers[questionId];
        if (answer === undefined || answer.kind !== 'rating') continue;
        const value = answer.values[row.id];
        if (typeof value === 'number') values.push(value);
      }
      const total = values.reduce((sum, value) => sum + value, 0);
      const high = values.filter((value) => value >= 4).length;
      return {
        id: row.id,
        label: row.label,
        mean: values.length === 0 ? 0 : round(total / values.length),
        responses: values.length,
        highPriorityShare: values.length === 0 ? 0 : round(high / values.length),
        scores: [1, 2, 3, 4, 5].map((score) => values.filter((value) => value === score).length),
      };
    })
    .sort((a, b) => b.mean - a.mean);
};

export interface Overview {
  readonly total: number;
  readonly byRole: readonly Tally[];
  readonly byRegion: readonly Tally[];
  /** Share of responses that reached the last section and answered something there. */
  readonly completionRate: number;
  readonly medianMinutes: number;
}

const median = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

export const overview = (
  questionnaire: Questionnaire,
  responses: readonly ConsultationResponse[],
): Overview => {
  const roleCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();
  for (const response of responses) {
    const role = response.role ?? 'not_given';
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
    for (const region of response.regions) regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
  }
  // The last section of the full version, less the follow-up code and the
  // permission to quote: both are asked of everybody, short version included,
  // so answering them says nothing about reaching the end of the full form.
  const designIds = questionnaire.projectDesign
    .flatMap((section) => section.questions)
    .filter((question) => !isPersonalQuestion(question))
    .map((question) => question.id);
  // Only the full version has that section. A short-version answer set is
  // complete by definition, and counting it either way would skew the rate.
  const full = responses.filter((response) => lengthOf(response.answers) !== 'short');
  const completed = full.filter((response) => designIds.some((id) => response.answers[id] !== undefined));
  const total = responses.length;

  const toTally = (entries: Map<string, number>, label: (id: string) => string): readonly Tally[] =>
    [...entries.entries()]
      .map(([id, count]) => ({ id, label: label(id), count, share: total === 0 ? 0 : round(count / total) }))
      .sort((a, b) => b.count - a.count);

  return {
    total,
    byRole: toTally(roleCounts, (id) => questionnaire.roles.find((role) => role.id === id)?.label ?? 'Not given'),
    byRegion: toTally(regionCounts, (id) => questionnaire.regions.find((region) => region.id === id)?.label ?? id),
    completionRate: full.length === 0 ? 0 : round(completed.length / full.length),
    medianMinutes: round(median(responses.map((response) => response.durationSeconds)) / 60, 1),
  };
};

/** Whether somebody's words may be quoted without their name. */
export type QuotePermission = 'yes' | 'no' | 'not_asked';

export const QUOTE_LABEL: Readonly<Record<QuotePermission, string>> = {
  yes: 'OK to quote, without their name',
  no: 'Do not quote',
  not_asked: 'Not asked about quoting',
};

/**
 * The answer to "is it all right to quote you". Somebody who took the short
 * version, or an interim check, was never asked, and that is not a yes.
 */
export const quotePermission = (response: ConsultationResponse): QuotePermission => {
  const answer = response.answers[QUOTE_OK_ID];
  if (answer?.kind !== 'single') return 'not_asked';
  if (answer.value === 'yes') return 'yes';
  if (answer.value === 'no') return 'no';
  return 'not_asked';
};

export interface FreeTextEntry {
  /** Shown on every comment, so a quote is never chosen from somebody who said no. */
  readonly quote: QuotePermission;
  readonly responseId: string;
  readonly questionId: string;
  readonly questionPrompt: string;
  readonly role: string | null;
  readonly text: string;
  readonly submittedAt: string;
}

export const freeTextEntries = (
  questionnaire: Questionnaire,
  responses: readonly ConsultationResponse[],
): readonly FreeTextEntry[] => {
  const entries: FreeTextEntry[] = [];
  for (const response of responses) {
    for (const [questionId, answer] of Object.entries(response.answers)) {
      // A row somebody named themselves on a practice list: where new
      // technology shows up first, so it is read with the comments.
      if (answer.kind === 'rating' && (answer.other ?? '').trim().length > 0) {
        const question = questionById(questionnaire, questionId);
        const value = answer.values[OTHER_ROW];
        const step =
          question?.kind === 'rating' && value !== undefined
            ? question.scale.find((point) => point.value === value)?.label
            : undefined;
        const named = (answer.other ?? '').trim();
        entries.push({
          quote: quotePermission(response),
          responseId: response.id,
          questionId,
          questionPrompt: `${OTHER_ROW_LABEL}, for: ${question?.prompt ?? questionId}`,
          role: response.role,
          text: step === undefined ? named : `${named} (${step})`,
          submittedAt: response.submittedAt,
        });
        continue;
      }
      if (answer.kind !== 'text' || answer.value.trim().length === 0) continue;
      const question = questionById(questionnaire, questionId);
      if (question !== undefined && isLinkCodeQuestion(question)) continue;
      entries.push({
        quote: quotePermission(response),
        responseId: response.id,
        questionId,
        questionPrompt: isNoteId(questionId) ? noteLabel(questionnaire, questionId) : (question?.prompt ?? questionId),
        role: response.role,
        text: answer.value.trim(),
        submittedAt: response.submittedAt,
      });
    }
  }
  return entries.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
};

/**
 * Among interviews, how often each item was raised before the list was read.
 * Only interviews can say this: a form shows everyone the list up front.
 */
export const unpromptedCounts = (
  responses: readonly ConsultationResponse[],
  questionId: string,
): { readonly interviews: number; readonly counts: ReadonlyMap<string, number> } => {
  const counts = new Map<string, number>();
  let interviews = 0;
  for (const response of responses) {
    if (!response.method.startsWith('interview_')) continue;
    const answer = response.answers[questionId];
    if (answer === undefined || answer.kind !== 'multi') continue;
    interviews += 1;
    const prompted = answer.prompted ?? [];
    for (const id of answer.values) {
      if (!prompted.includes(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return { interviews, counts };
};
