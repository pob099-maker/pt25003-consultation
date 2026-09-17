import { optionLabel, trackingQuestions } from '../content/lookup';
import type { ConsultationResponse, Question, Questionnaire, RoundStage } from '../types';

/**
 * Baseline against every review, for the tracked questions only.
 *
 * Two things this deliberately does not do. It does not follow individuals —
 * responses are anonymous, so each round is a separate picture of the industry
 * and the comparison is between pictures. And it never reports a change
 * without the number of people behind each side of it, because a shift from
 * twelve respondents and a shift from two hundred look identical as
 * percentages and mean very different things.
 */

export interface RoundInfo {
  readonly roundId: string;
  readonly label: string;
  readonly stage: RoundStage;
}

export interface RoundColumn extends RoundInfo {
  readonly respondents: number;
}

export interface ChangeRow {
  readonly id: string;
  readonly label: string;
  /** Per round, in column order: a share (0–1) or a mean (1–5); null where nobody answered. */
  readonly values: readonly (number | null)[];
  /** Latest review minus baseline, when both exist. */
  readonly change: number | null;
}

export interface ChangeBlock {
  readonly questionId: string;
  readonly prompt: string;
  readonly measure: 'share' | 'mean';
  /** People who answered this question, per round, in column order. */
  readonly answered: readonly number[];
  readonly rows: readonly ChangeRow[];
}

export interface Comparison {
  readonly columns: readonly RoundColumn[];
  readonly blocks: readonly ChangeBlock[];
  /** Who answered each round, so a shift in the mix is not read as a shift in opinion. */
  readonly composition: readonly { readonly role: string; readonly counts: readonly number[] }[];
  readonly hasBaseline: boolean;
  readonly hasReview: boolean;
}

/** Below this, a round's figure for a question is shown but flagged as thin. */
export const THIN = 10;

const round3 = (value: number): number => Number(value.toFixed(3));

const optionIds = (question: Question): readonly string[] => {
  if (question.kind === 'multi' || question.kind === 'single') return question.options.map((option) => option.id);
  if (question.kind === 'rating') return question.rows.map((row) => row.id);
  if (question.kind === 'rank') return question.fallbackOptions.map((option) => option.id);
  return [];
};

/** The choices one response made for one question, or null if it did not answer. */
const chosen = (question: Question, response: ConsultationResponse): readonly string[] | null => {
  const answer = response.answers[question.id];
  if (answer === undefined) return null;
  if (answer.kind === 'multi' || answer.kind === 'rank') return answer.values.length === 0 ? null : answer.values;
  if (answer.kind === 'single') return [answer.value];
  return null;
};

export const compareRounds = (
  questionnaire: Questionnaire,
  responses: readonly ConsultationResponse[],
  rounds: readonly RoundInfo[],
): Comparison => {
  // Pilots are never part of a comparison: they were the team testing the form.
  const comparable = rounds.filter((round) => round.stage !== 'pilot');
  const byRound = comparable.map((round) => responses.filter((response) => response.roundId === round.roundId));

  const columns: RoundColumn[] = comparable.map((round, index) => ({
    ...round,
    respondents: byRound[index]?.length ?? 0,
  }));

  const baselineIndex = comparable.findIndex((round) => round.stage === 'baseline');
  let latestReviewIndex = -1;
  comparable.forEach((round, index) => {
    if (round.stage === 'review') latestReviewIndex = index;
  });

  const changeOf = (values: readonly (number | null)[]): number | null => {
    if (baselineIndex < 0 || latestReviewIndex < 0) return null;
    const before = values[baselineIndex];
    const after = values[latestReviewIndex];
    if (before === null || before === undefined || after === null || after === undefined) return null;
    return round3(after - before);
  };

  const blocks: ChangeBlock[] = trackingQuestions(questionnaire).map((question) => {
    if (question.kind === 'rating') {
      const answered = byRound.map(
        (group) => group.filter((response) => response.answers[question.id]?.kind === 'rating').length,
      );
      const rows = question.rows.map((row) => {
        const values = byRound.map((group) => {
          const ratings: number[] = [];
          for (const response of group) {
            const answer = response.answers[question.id];
            if (answer?.kind !== 'rating') continue;
            const value = answer.values[row.id];
            if (typeof value === 'number') ratings.push(value);
          }
          return ratings.length === 0 ? null : round3(ratings.reduce((sum, value) => sum + value, 0) / ratings.length);
        });
        return { id: row.id, label: row.label, values, change: changeOf(values) };
      });
      return { questionId: question.id, prompt: question.prompt, measure: 'mean', answered, rows };
    }

    const answeredSets = byRound.map((group) =>
      group.map((response) => chosen(question, response)).filter((value): value is readonly string[] => value !== null),
    );
    const answered = answeredSets.map((set) => set.length);
    const rows = optionIds(question).map((id) => {
      const values = answeredSets.map((set) =>
        set.length === 0 ? null : round3(set.filter((choices) => choices.includes(id)).length / set.length),
      );
      return { id, label: optionLabel(question, id), values, change: changeOf(values) };
    });
    return { questionId: question.id, prompt: question.prompt, measure: 'share', answered, rows };
  });

  const roles = new Set<string>();
  for (const group of byRound) for (const response of group) roles.add(response.role ?? 'not given');
  const composition = [...roles].sort().map((role) => ({
    role,
    counts: byRound.map((group) => group.filter((response) => (response.role ?? 'not given') === role).length),
  }));

  return {
    columns,
    blocks,
    composition,
    hasBaseline: baselineIndex >= 0,
    hasReview: latestReviewIndex >= 0,
  };
};
