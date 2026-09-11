import { optionLabel, questionById } from '../content/lookup';
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
  const designIds = questionnaire.projectDesign.flatMap((section) => section.questions.map((q) => q.id));
  const completed = responses.filter((response) => designIds.some((id) => response.answers[id] !== undefined));
  const total = responses.length;

  const toTally = (entries: Map<string, number>, label: (id: string) => string): readonly Tally[] =>
    [...entries.entries()]
      .map(([id, count]) => ({ id, label: label(id), count, share: total === 0 ? 0 : round(count / total) }))
      .sort((a, b) => b.count - a.count);

  return {
    total,
    byRole: toTally(roleCounts, (id) => questionnaire.roles.find((role) => role.id === id)?.label ?? 'Not given'),
    byRegion: toTally(regionCounts, (id) => questionnaire.regions.find((region) => region.id === id)?.label ?? id),
    completionRate: total === 0 ? 0 : round(completed.length / total),
    medianMinutes: round(median(responses.map((response) => response.durationSeconds)) / 60, 1),
  };
};

export interface FreeTextEntry {
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
      if (answer.kind !== 'text' || answer.value.trim().length === 0) continue;
      const question = questionById(questionnaire, questionId);
      entries.push({
        responseId: response.id,
        questionId,
        questionPrompt: question?.prompt ?? questionId,
        role: response.role,
        text: answer.value.trim(),
        submittedAt: response.submittedAt,
      });
    }
  }
  return entries.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
};
