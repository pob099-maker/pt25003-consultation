import { z } from 'zod';
import { libraryQuestion } from '../content/library';
import { OTHER_ROW, allQuestions, isLinkCodeQuestion, isSafeId } from '../content/lookup';
import type { Answer, ConsultationResponse, Option, Question, Questionnaire, RoundStage, Section } from '../types';

/**
 * What a round may change about the questionnaire, and what it may not.
 *
 * Kept apart from the database calls in rounds.ts so the demonstration, the
 * change-over-time view and the tests all apply exactly the rules the live
 * form applies, without needing a backend to do it.
 */

/**
 * Wording overrides for a round. Question ids and option ids are never
 * changed here — only the words attached to them — so a response recorded in
 * an earlier round still means what it meant when it was given, and the two
 * rounds remain comparable. Adding a new option is allowed; removing one is
 * not, because historic answers point at it.
 */
export interface QuestionOverride {
  readonly prompt?: string;
  readonly help?: string;
  readonly optionLabels?: Readonly<Record<string, string>>;
  /** New options, or on a watch list, new rows. */
  readonly addedOptions?: readonly Option[];
  /**
   * Rows of a watch list not asked this round. Stopping is not deleting: the
   * row, and every answer already given to it, stay in every report.
   */
  readonly retiredOptions?: readonly string[];
  /**
   * Leave the question out of this round. Its id, and every answer already
   * given to it, stay as they were — retiring is not deleting. Tracked
   * questions cannot be retired: the change-over-time view depends on them.
   */
  readonly retired?: boolean;
  /**
   * Bring a question in from the shared library, at the end of the section
   * with this id. Ignored for a question the questionnaire already has.
   */
  readonly addTo?: string;
  /**
   * Ask this question in an interim check. An interim asks only these, plus
   * the follow-up code, so it stays short enough to be worth sending. Every
   * other kind of round ignores it.
   */
  readonly inInterim?: boolean;
}

/** Enough of a round to work out what it asked. */
export interface RoundDefinition {
  readonly roundId: string;
  readonly label: string;
  readonly stage: RoundStage;
  readonly overrides: Readonly<Record<string, QuestionOverride>>;
}

export interface RoundConfig extends RoundDefinition {
  readonly isActive: boolean;
}

type RatingQuestion = Extract<Question, { kind: 'rating' }>;

export const isWatchList = (question: Question): question is RatingQuestion =>
  question.kind === 'rating' && question.openRows === true;

/** Rounds that ask what people saw and changed. An interim asks it only if the team ticks it. */
export const asksFollowUp = (stage: RoundStage): boolean => stage === 'review' || stage === 'interim';

const applyToOptions = (options: readonly Option[], override: QuestionOverride | undefined): readonly Option[] => {
  if (override === undefined) return options;
  const renamed = options.map((option) => {
    const label = override.optionLabels?.[option.id];
    return label === undefined ? option : { ...option, label };
  });
  return [...renamed, ...(override.addedOptions ?? [])];
};

/**
 * The rows a watch list asks in one round: its own, then any the round adds,
 * less any it stops. An added row can never redefine one that exists, and the
 * list is never left with nothing to answer: stop every row and the round
 * asks the originals. The round editor shows its ticks from this same rule,
 * so what the team sees ticked is what respondents are asked.
 */
export const rowsAsked = (question: RatingQuestion, override: QuestionOverride | undefined): readonly Option[] => {
  if (override === undefined) return question.rows;
  const seen = new Set(question.rows.map((row) => row.id));
  const added: Option[] = [];
  for (const row of override.addedOptions ?? []) {
    if (seen.has(row.id) || row.id === OTHER_ROW || !isSafeId(row.id)) continue;
    seen.add(row.id);
    added.push(row);
  }
  const stopped = new Set(override.retiredOptions ?? []);
  const rows = [...question.rows, ...added].filter((row) => !stopped.has(row.id));
  return rows.length === 0 ? question.rows : rows;
};

const applyToQuestion = (question: Question, override: QuestionOverride | undefined): Question => {
  if (override === undefined) return question;
  if (question.tracking === true) {
    // A tracked question's words are fixed. A watch list may still grow.
    return isWatchList(question) ? { ...question, rows: rowsAsked(question, override) } : question;
  }
  const base = {
    ...question,
    prompt: override.prompt ?? question.prompt,
    help: override.help ?? question.help,
  };
  if (base.kind === 'multi' || base.kind === 'single') {
    return { ...base, options: applyToOptions(base.options, override) };
  }
  if (base.kind === 'rating') {
    return { ...base, rows: applyToOptions(base.rows, override) };
  }
  if (base.kind === 'rank') {
    return { ...base, fallbackOptions: applyToOptions(base.fallbackOptions, override) };
  }
  return base;
};

const isRetired = (question: Question, override: QuestionOverride | undefined): boolean =>
  override?.retired === true && question.tracking !== true;

/**
 * Whether a round puts this question to people. An interim asks only what the
 * team ticked, and the follow-up code, which is how an interim answer is
 * linked to the same person at the next full round.
 */
const asksIn = (question: Question, round: RoundDefinition): boolean => {
  const override = round.overrides[question.id];
  if (round.stage === 'interim') return isLinkCodeQuestion(question) || override?.inInterim === true;
  return !isRetired(question, override);
};

const applySections = (
  base: Questionnaire,
  overrides: RoundDefinition['overrides'],
  include: (question: Question) => boolean,
): Pick<Questionnaire, 'core' | 'followUp' | 'pathways' | 'projectDesign'> => {
  const existing = new Set(allQuestions(base).map((question) => question.id));
  const apply = (section: Section): Section => {
    const added = Object.entries(overrides)
      .filter(([id, override]) => override.addTo === section.id && !existing.has(id))
      .map(([id]) => libraryQuestion(id))
      .filter((question): question is Question => question !== undefined);
    return {
      ...section,
      questions: [...section.questions, ...added]
        .filter(include)
        .map((question) => applyToQuestion(question, overrides[question.id])),
    };
  };
  // A step with nothing on it is only a blank screen.
  const filled = (section: Section): boolean => section.questions.length > 0;
  return {
    core: base.core.map(apply).filter(filled),
    followUp: base.followUp.map(apply).filter(filled),
    pathways: Object.fromEntries(
      Object.entries(base.pathways)
        .map(([key, section]) => [key, apply(section)] as const)
        .filter(([, section]) => filled(section)),
    ),
    projectDesign: base.projectDesign.map(apply).filter(filled),
  };
};

/**
 * The questionnaire one round puts to people. Follow-up questions ask what
 * people saw and changed since the project started, so a round that is not a
 * follow-up has none. Deciding it here rather than in each screen means the
 * form, the time estimate, the phone script and the change view all agree on
 * what a starting point asked.
 */
export const applyRound = (base: Questionnaire, round: RoundDefinition): Questionnaire => {
  const sections = applySections(base, round.overrides, (question) => asksIn(question, round));
  return {
    ...base,
    roundId: round.roundId,
    roundLabel: round.label,
    stage: round.stage,
    ...sections,
    followUp: asksFollowUp(round.stage) ? sections.followUp : [],
  };
};

/**
 * Every row a rating question has ever had: its own, then each row a round
 * added, in the order they first appeared, and last any row an answer points
 * at that no round defines any more, so no answer is ever invisible in a report.
 */
export const everyRow = (
  question: RatingQuestion,
  rounds: readonly Pick<RoundDefinition, 'overrides'>[],
  responses: readonly ConsultationResponse[] = [],
): readonly Option[] => {
  const rows: Option[] = [...question.rows];
  const seen = new Set(rows.map((row) => row.id));
  for (const round of rounds) {
    for (const row of round.overrides[question.id]?.addedOptions ?? []) {
      if (seen.has(row.id) || row.id === OTHER_ROW || !isSafeId(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  }
  for (const response of responses) {
    const answer = response.answers[question.id];
    if (answer?.kind !== 'rating') continue;
    for (const [id, value] of Object.entries(answer.values)) {
      if (seen.has(id) || id === OTHER_ROW || !isSafeId(id) || typeof value !== 'number') continue;
      seen.add(id);
      rows.push({ id, label: `${id} (no longer on the list)` });
    }
  }
  return rows;
};

/** Answer keys the tools write for themselves, which are not questions. */
const isToolKey = (id: string): boolean => id.startsWith('interview__');

const distinctIds = (ids: readonly string[]): readonly Option[] =>
  [...new Set(ids)].filter(isSafeId).map((id) => ({ id, label: id }));

/**
 * A stand-in for a question that answers point at but no questionnaire or
 * library defines any more, built from the answers themselves, so nothing
 * anybody said drops out of the export because a question was later removed.
 */
const retiredQuestion = (id: string, answers: readonly Answer[]): Question | null => {
  const library = libraryQuestion(id);
  if (library !== undefined) return library;
  const first = answers[0];
  if (first === undefined) return null;
  const prompt = `${id} (no longer asked)`;
  switch (first.kind) {
    case 'multi':
      return {
        id,
        kind: 'multi',
        prompt,
        options: distinctIds(answers.flatMap((answer) => (answer.kind === 'multi' ? answer.values : []))),
        allowOther: answers.some((answer) => answer.kind === 'multi' && (answer.other ?? '').trim().length > 0),
      };
    case 'single':
      return {
        id,
        kind: 'single',
        prompt,
        options: distinctIds(answers.flatMap((answer) => (answer.kind === 'single' ? [answer.value] : []))),
      };
    case 'rank':
      return {
        id,
        kind: 'rank',
        prompt,
        count: Math.max(1, ...answers.map((answer) => (answer.kind === 'rank' ? answer.values.length : 0))),
        sourceQuestionId: id,
        fallbackOptions: distinctIds(answers.flatMap((answer) => (answer.kind === 'rank' ? answer.values : []))),
      };
    case 'rating':
      return {
        id,
        kind: 'rating',
        prompt,
        scale: [1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) })),
        rows: distinctIds(
          answers.flatMap((answer) => (answer.kind === 'rating' ? Object.keys(answer.values) : [])),
        ).filter((row) => row.id !== OTHER_ROW),
      };
    case 'text':
      return { id, kind: 'text', prompt };
  }
};

/** Questions answered in some response that nothing else in the frame defines. */
const noLongerAsked = (frame: Questionnaire, responses: readonly ConsultationResponse[]): Section | null => {
  const known = new Set(allQuestions(frame).map((question) => question.id));
  const answered = new Map<string, Answer[]>();
  for (const response of responses) {
    for (const [id, answer] of Object.entries(response.answers)) {
      if (known.has(id) || isToolKey(id) || !isSafeId(id)) continue;
      answered.set(id, [...(answered.get(id) ?? []), answer]);
    }
  }
  const questions = [...answered.entries()]
    .map(([id, answers]) => retiredQuestion(id, answers))
    .filter((question): question is Question => question !== null);
  return questions.length === 0 ? null : { id: 'no_longer_asked', title: 'No longer asked', questions };
};

const firstById = (options: readonly Option[]): readonly Option[] => {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
};

/**
 * Everything any round asked, for the admin screens and the export: every
 * question, every added option and every watch-list row, stopped or not,
 * worded the way the round collecting now words it.
 *
 * What one round shows a respondent comes from applyRound. A report has to
 * cover every answer already given, or stopping a row, or retiring a
 * question, would quietly drop its history from the export and the charts.
 */
export const reportingFrame = (
  base: Questionnaire,
  rounds: readonly RoundDefinition[],
  activeRoundId: string | null,
  responses: readonly ConsultationResponse[] = [],
): Questionnaire => {
  // The active round goes last, so its wording is the wording shown.
  const ordered = [
    ...rounds.filter((round) => round.roundId !== activeRoundId),
    ...rounds.filter((round) => round.roundId === activeRoundId),
  ];
  const merged: Record<string, QuestionOverride> = {};
  for (const round of ordered) {
    for (const [id, override] of Object.entries(round.overrides)) {
      const previous = merged[id] ?? {};
      merged[id] = {
        prompt: override.prompt ?? previous.prompt,
        help: override.help ?? previous.help,
        optionLabels: { ...(previous.optionLabels ?? {}), ...(override.optionLabels ?? {}) },
        addedOptions: firstById([...(previous.addedOptions ?? []), ...(override.addedOptions ?? [])]),
        addTo: previous.addTo ?? override.addTo,
      };
    }
  }
  const active = rounds.find((round) => round.roundId === activeRoundId);
  const frame: Questionnaire = {
    ...base,
    roundId: active?.roundId ?? base.roundId,
    roundLabel: active?.label ?? base.roundLabel,
    stage: active?.stage ?? base.stage,
    ...applySections(base, merged, () => true),
  };
  const withEveryRow = (section: Section): Section => ({
    ...section,
    questions: section.questions.map((question) =>
      question.kind === 'rating' ? { ...question, rows: everyRow(question, [], responses) } : question,
    ),
  });
  const complete: Questionnaire = {
    ...frame,
    core: frame.core.map(withEveryRow),
    followUp: frame.followUp.map(withEveryRow),
    pathways: Object.fromEntries(Object.entries(frame.pathways).map(([key, section]) => [key, withEveryRow(section)])),
    projectDesign: frame.projectDesign.map(withEveryRow),
  };
  const retired = noLongerAsked(complete, responses);
  return retired === null ? complete : { ...complete, followUp: [...complete.followUp, retired] };
};

const withoutInterimChoices = (override: QuestionOverride): QuestionOverride =>
  Object.fromEntries(Object.entries(override).filter(([key]) => key !== 'inInterim')) as QuestionOverride;

/**
 * What a new round starts with, given every round so far in the order they
 * were created. The last full round's settings carry on, and so does any row
 * an interim added: the interim was that row's starting point, and the rounds
 * after it are where it gets compared.
 *
 * What an interim left out does not carry on. A full round asks everything,
 * and an interim that stopped the old rows for a few minutes' focus must never
 * stop them at the final review.
 */
export const nextRoundOverrides = (rounds: readonly RoundDefinition[]): Record<string, QuestionOverride> => {
  let lastFull = -1;
  rounds.forEach((round, index) => {
    if (round.stage !== 'interim') lastFull = index;
  });
  const result: Record<string, QuestionOverride> = {};
  for (const [id, override] of Object.entries(rounds[lastFull]?.overrides ?? {})) {
    result[id] = withoutInterimChoices(override);
  }
  for (const round of rounds.slice(lastFull + 1)) {
    for (const [id, override] of Object.entries(round.overrides)) {
      const previous = result[id] ?? {};
      const known = new Set((previous.addedOptions ?? []).map((row) => row.id));
      const fresh = (override.addedOptions ?? []).filter((row) => !known.has(row.id));
      if (fresh.length === 0) continue;
      const freshIds = new Set(fresh.map((row) => row.id));
      result[id] = {
        ...previous,
        addedOptions: [...(previous.addedOptions ?? []), ...fresh],
        retiredOptions: (previous.retiredOptions ?? []).filter((rowId) => !freshIds.has(rowId)),
      };
    }
  }
  return result;
};

/** A new row's id, from its words: readable in an export, and never one already used. */
export const newRowId = (label: string, taken: ReadonlySet<string>): string => {
  const slug =
    label
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40)
      .replace(/_+$/g, '') || 'row';
  let id = slug;
  for (let next = 2; taken.has(id) || id === OTHER_ROW || !isSafeId(id); next += 1) id = `${slug}_${next}`;
  return id;
};

/** What the editor knows about a round beyond the round itself. */
export interface RoundContext {
  /** Every other round of the project, as saved. */
  readonly others: readonly RoundDefinition[];
  /** The kind of round this one was when it was last saved, if it has been. */
  readonly savedStage?: RoundStage | null;
  /** How many responses this round already holds. */
  readonly responses?: number;
}

/**
 * Why a round cannot be saved as it stands, in words for the person saving
 * it. The editor checks before it offers Save, and saveRound checks again, so
 * a rule that lives only on a screen cannot be walked past by a stored round.
 */
export const roundProblems = (
  base: Questionnaire,
  round: RoundDefinition,
  context: RoundContext = { others: [] },
): readonly string[] => {
  const problems: string[] = [];
  if (round.roundId.trim().length === 0) problems.push('Give it a short code.');
  if (round.label.trim().length === 0) problems.push('Give it a name.');
  if (context.others.some((other) => other.roundId === round.roundId)) {
    problems.push(`The short code "${round.roundId}" already belongs to another round. Choose a different one.`);
  }
  if (round.stage === 'baseline') {
    const existing = context.others.find((other) => other.stage === 'baseline');
    if (existing !== undefined) {
      problems.push(
        `There is already a starting point, "${existing.label}". A project has only one: start a follow-up or an interim check instead.`,
      );
    }
  }
  if (round.stage === 'interim') {
    const asks = allQuestions(applyRound(base, round)).filter((question) => !isLinkCodeQuestion(question));
    if (asks.length === 0) {
      problems.push(
        'An interim check has to ask something. Tick at least one question for it: as it stands it would ask nothing but the follow-up code.',
      );
    }
  }
  const held = context.responses ?? 0;
  if (context.savedStage !== undefined && context.savedStage !== null && context.savedStage !== round.stage && held > 0) {
    problems.push(
      `This round already has ${held} response${held === 1 ? '' : 's'}, so what kind of round it is cannot change now. Start a new round instead.`,
    );
  }
  return problems;
};

/** What somebody types to add a row to a watch list, checked before it is saved. */
export const newRowSchema = z.object({
  label: z
    .string()
    .trim()
    .min(3, 'Say what it is in a few words.')
    .max(120, 'Keep it under 120 characters. The detail can go in the note.'),
  help: z.string().trim().max(200, 'Keep the note under 200 characters.'),
});

export type NewRow = z.infer<typeof newRowSchema>;
