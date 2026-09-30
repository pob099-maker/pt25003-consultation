import { OTHER_ROW, optionLabel, questionById, trackingQuestions } from '../content/lookup';
import { applyRound, reportingFrame, type QuestionOverride } from './roundRules';
import type { ConsultationResponse, Question, RoundStage, Questionnaire } from '../types';
import type { SlopeInput } from '../lib/chartImage';

/**
 * Baseline against every review, for the tracked questions only.
 *
 * Two things this deliberately does not do. It does not follow individuals —
 * responses are anonymous, so each round is a separate picture of the industry
 * and the comparison is between pictures. And it never reports a change
 * without the number of people behind each side of it, because a shift from
 * twelve respondents and a shift from two hundred look identical as
 * percentages and mean very different things.
 *
 * One rule covers the rows that come and go. A watch list can gain a row
 * part-way through the project, or stop asking one, so each row is compared
 * from the first round that asked it to the latest review that asked it. A
 * round that did not ask something shows nothing for it rather than a zero.
 * An interim check can be where a row starts, but it is never where a
 * comparison ends, and it never moves a start that already exists.
 */
export interface RoundInfo {
  readonly roundId: string;
  readonly label: string;
  readonly stage: RoundStage;
  /** What the round changed, so the comparison knows which rows it asked. */
  readonly overrides?: Readonly<Record<string, QuestionOverride>>;
}

export interface RoundColumn extends RoundInfo {
  readonly respondents: number;
}

export interface ChangeRow {
  readonly id: string;
  readonly label: string;
  /** Per round, in column order: a share (0–1) or a mean (1–5); null where nobody answered or it was not asked. */
  readonly values: readonly (number | null)[];
  /** Per round, in column order: whether that round asked this at all. */
  readonly asked: readonly boolean[];
  /** The column a change is measured from: the first round that asked it. */
  readonly from: number | null;
  /** The column a change is measured to: the latest review that asked it. */
  readonly to: number | null;
  /** The value at `to` less the value at `from`, when both exist. */
  readonly change: number | null;
}

export interface ChangeBlock {
  readonly questionId: string;
  readonly prompt: string;
  readonly measure: 'share' | 'mean';
  /** People who answered this question, per round, in column order. */
  readonly answered: readonly number[];
  /** Per round, in column order: whether that round asked this question at all. */
  readonly asked: readonly boolean[];
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
export const THIN = 5;

const round3 = (value: number): number => Number(value.toFixed(3));

const optionIds = (question: Question): readonly string[] => {
  if (question.kind === 'multi' || question.kind === 'single') return question.options.map((option) => option.id);
  if (question.kind === 'rating')
    return question.rows.map((row) => row.id).filter((id) => id !== OTHER_ROW);
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

/** Whether a response rated anything on the list, not just a row it named itself. */
const ratedAnything = (response: ConsultationResponse, questionId: string): boolean => {
  const answer = response.answers[questionId];
  return answer?.kind === 'rating' && Object.keys(answer.values).some((id) => id !== OTHER_ROW);
};

/**
 * @param base the questionnaire every round starts from. Each round's own
 *   changes are applied here, by the same rules the form applied, so the
 *   comparison knows exactly what each round asked.
 */
export const compareRounds = (
  base: Questionnaire,
  responses: readonly ConsultationResponse[],
  rounds: readonly RoundInfo[],
): Comparison => {
  // Pilots are never part of a comparison: they were the team testing the form.
  const comparable = rounds
    .filter((round) => round.stage !== 'pilot')
    .map((round) => ({ ...round, overrides: round.overrides ?? {} }));
  const byRound = comparable.map((round) => responses.filter((response) => response.roundId === round.roundId));
  const askedBy = comparable.map((round) => applyRound(base, round));
  // Every row any of these rounds asked, and any row an answer points at.
  const frame = reportingFrame(base, comparable, null, byRound.flat());

  const columns: RoundColumn[] = comparable.map((round, index) => ({
    ...round,
    respondents: byRound[index]?.length ?? 0,
  }));

  const baselineIndex = comparable.findIndex((round) => round.stage === 'baseline');
  let latestReviewIndex = -1;
  comparable.forEach((round, index) => {
    if (round.stage === 'review') latestReviewIndex = index;
  });

  const span = (
    asked: readonly boolean[],
    values: readonly (number | null)[],
  ): Pick<ChangeRow, 'from' | 'to' | 'change'> => {
    const from = asked.indexOf(true);
    let to = -1;
    asked.forEach((wasAsked, index) => {
      if (wasAsked && index > from && comparable[index]?.stage === 'review') to = index;
    });
    if (from < 0 || to < 0) return { from: from < 0 ? null : from, to: null, change: null };
    const before = values[from];
    const after = values[to];
    const change =
      before === null || before === undefined || after === null || after === undefined ? null : round3(after - before);
    return { from, to, change };
  };

  // A written answer cannot be counted across rounds. The follow-up code is
  // the one tracked text question, and it links people, it is not a measure.
  const measured = trackingQuestions(frame).filter((question) => question.kind !== 'text');

  const blocks: ChangeBlock[] = measured.map((question) => {
    const inRound = askedBy.map((asked) => questionById(asked, question.id));
    // Asked in a round if the round asks it now, or anybody in it answered it.
    // The second half keeps answers already given when a line is stopped, or
    // an interim question unticked, while the round is still collecting.
    const askedQuestion = inRound.map(
      (found, index) =>
        found !== undefined || (byRound[index] ?? []).some((response) => response.answers[question.id] !== undefined),
    );

    if (question.kind === 'rating') {
      const answered = byRound.map((group, index) =>
        askedQuestion[index] ? group.filter((response) => ratedAnything(response, question.id)).length : 0,
      );
      const rows = optionIds(question).map((rowId) => {
        const asked = inRound.map(
          (found, index) =>
            (found?.kind === 'rating' && found.rows.some((row) => row.id === rowId)) ||
            (byRound[index] ?? []).some((response) => {
              const answer = response.answers[question.id];
              return answer?.kind === 'rating' && typeof answer.values[rowId] === 'number';
            }),
        );
        const values = byRound.map((group, index) => {
          if (asked[index] !== true) return null;
          const ratings: number[] = [];
          for (const response of group) {
            const answer = response.answers[question.id];
            if (answer?.kind !== 'rating') continue;
            const value = answer.values[rowId];
            if (typeof value === 'number') ratings.push(value);
          }
          return ratings.length === 0 ? null : round3(ratings.reduce((sum, value) => sum + value, 0) / ratings.length);
        });
        return { id: rowId, label: optionLabel(question, rowId), values, asked, ...span(asked, values) };
      });
      return { questionId: question.id, prompt: question.prompt, measure: 'mean', answered, asked: askedQuestion, rows };
    }

    const answeredSets = byRound.map((group, index) =>
      askedQuestion[index]
        ? group
            .map((response) => chosen(question, response))
            .filter((value): value is readonly string[] => value !== null)
        : [],
    );
    const answered = answeredSets.map((set) => set.length);
    const rows = optionIds(question).map((id) => {
      const values = answeredSets.map((set, index) =>
        askedQuestion[index] !== true || set.length === 0
          ? null
          : round3(set.filter((choices) => choices.includes(id)).length / set.length),
      );
      return { id, label: optionLabel(question, id), values, asked: askedQuestion, ...span(askedQuestion, values) };
    });
    return { questionId: question.id, prompt: question.prompt, measure: 'share', answered, asked: askedQuestion, rows };
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

/**
 * What a reader needs to know about a row that was not asked every time: where
 * its comparison starts, and when it stopped being asked. Nothing for a row
 * asked in every round.
 */
export const rowHistory = (row: ChangeRow, columns: readonly RoundColumn[]): string | null => {
  const notes: string[] = [];
  const first = row.from === null ? undefined : columns[row.from];
  if (first !== undefined && first.stage !== 'baseline') notes.push(`First asked in ${first.label}`);
  // Stopped only if a later full round left it out. An interim asks just what
  // the team ticked, so one that happens to be the newest round says nothing
  // about whether a line is still being followed.
  const lastAsked = row.asked.lastIndexOf(true);
  const lastAskedColumn = columns[lastAsked];
  const laterFullRound = columns.some((column, index) => index > lastAsked && column.stage !== 'interim');
  if (lastAsked >= 0 && laterFullRound && lastAskedColumn !== undefined)
    notes.push(`not asked after ${lastAskedColumn.label}`);
  if (notes.length === 0) return null;
  const sentence = notes.join(', ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
};

/**
 * What the chart draws for a row: its first asked round to the review its
 * change is measured to, and nothing either side. The chart colours a line by
 * its first and last points, so a trailing interim left in would end the line
 * there and disagree with the Change column beside it.
 */
export const chartInput = (rows: readonly ChangeRow[]): readonly SlopeInput[] =>
  rows.map((row) => ({
    label: row.label,
    values: row.values.map((value, index) => {
      if (row.from === null || index < row.from) return null;
      if (row.to === null) return index === row.from ? value : null;
      return index > row.to ? null : value;
    }),
  }));
