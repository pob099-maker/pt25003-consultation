import { z } from 'zod';
import { getSupabase } from '../lib/supabase';
import { STORAGE_KEYS, readJson, writeJson } from '../lib/storage';
import { questionById } from '../content/lookup';
import type { Answer, AnswerMap, Option, Question, Questionnaire, Result } from '../types';
import { groupQuestions } from './groups';
import { currentProject } from '../content/projects';

export const WORKSHOPS_TABLE = 'consultation_workshops';

/** Results stay hidden until this many people have answered. Matches the database. */
export const MIN_ANSWERS = 5;

/** No 0/O or 1/I, so a code read off a projector is typed correctly first time. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const newWorkshopCode = (random: () => number = Math.random): string =>
  Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]).join('');

export const normaliseCode = (raw: string): string => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

/** Every kind of question can be put to a room: choices as bars, ratings as averages, text as a word cloud. */
export type WorkshopQuestion = Question;
export type ChoiceQuestion = Extract<Question, { kind: 'multi' | 'single' | 'rank' }>;
export type RatingQuestion = Extract<Question, { kind: 'rating' }>;

export const isChoiceQuestion = (question: Question): question is ChoiceQuestion =>
  question.kind === 'multi' || question.kind === 'single' || question.kind === 'rank';

/** The shared questions a room can answer together. Role branches are left out: a room is mixed. */
export const workshopQuestions = (questionnaire: Questionnaire): readonly WorkshopQuestion[] =>
  groupQuestions(questionnaire);

/**
 * What goes on the screen. The conversational opener suits a room, except for
 * a rating, whose opener is an interviewer's "I'll read out some areas".
 */
export const screenPrompt = (question: WorkshopQuestion): string =>
  question.kind === 'rating' ? question.prompt : (question.guide?.open ?? question.prompt);

/** Words or short phrases one phone may add to a word cloud. */
export const MAX_WORDS = 3;
export const MAX_WORD_LENGTH = 40;

export const workshopChoices = (question: WorkshopQuestion): readonly Option[] => {
  if (question.kind === 'rank') return question.fallbackOptions;
  if (question.kind === 'multi' || question.kind === 'single') return question.options;
  if (question.kind === 'rating') return question.rows;
  return [];
};

export const maxChoices = (question: ChoiceQuestion): number => {
  if (question.kind === 'single') return 1;
  if (question.kind === 'rank') return question.count;
  return question.options.length;
};

export const choiceHint = (question: WorkshopQuestion): string => {
  switch (question.kind) {
    case 'single':
      return 'Pick one.';
    case 'rank':
      return `Pick up to ${question.count}, most important first.`;
    case 'multi':
      return 'Pick all that apply.';
    case 'rating':
      return 'Tap a score for each one you have a view on. Skip the rest.';
    case 'text':
      return `A word or a short phrase — up to ${MAX_WORDS}.`;
  }
};

/** A rating travels as `row=score` strings, so one vote shape serves every kind of question. */
export const encodeRating = (values: Readonly<Record<string, number>>): readonly string[] =>
  Object.entries(values).map(([row, score]) => `${row}=${score}`);

export const decodeRating = (choices: readonly string[]): Record<string, number> => {
  const values: Record<string, number> = {};
  for (const choice of choices) {
    const match = /^(.+)=([1-5])$/.exec(choice);
    if (match?.[1] !== undefined && match[2] !== undefined) values[match[1]] = Number(match[2]);
  }
  return values;
};

/** Trimmed, de-duplicated, capped. Counting is case-insensitive, so lower case loses nothing. */
export const cleanWords = (raw: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const entry of raw) {
    const word = entry.trim().replace(/\s+/g, ' ').slice(0, MAX_WORD_LENGTH).toLowerCase();
    if (word.length === 0 || seen.has(word)) continue;
    seen.add(word);
    words.push(word);
  }
  return words.slice(0, MAX_WORDS);
};

/** Tapping adds or removes; a single-choice question swaps; a full ranking refuses more. */
export const toggleChoice = (question: ChoiceQuestion, current: readonly string[], id: string): readonly string[] => {
  if (current.includes(id)) return current.filter((value) => value !== id);
  if (question.kind === 'single') return [id];
  if (current.length >= maxChoices(question)) return current;
  return [...current, id];
};

const stateSchema = z.union([
  z.object({ found: z.literal(false) }),
  z.object({
    found: z.literal(true),
    id: z.string().uuid(),
    title: z.string(),
    roundId: z.string(),
    status: z.enum(['open', 'closed']),
    questionIds: z.array(z.string()),
    index: z.number().int(),
    questionId: z.string().nullable(),
    revealed: z.boolean(),
    answered: z.number().int(),
    minAnswers: z.number().int(),
    results: z.record(z.string(), z.number()).nullable(),
    hidden: z.array(z.string()).default([]),
  }),
]);

export type WorkshopState = z.infer<typeof stateSchema>;
export type LiveWorkshop = Extract<WorkshopState, { found: true }>;

export interface WorkshopSummary {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly roundId: string;
  readonly status: 'open' | 'closed';
  readonly questionIds: readonly string[];
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// Demo mode: a workshop lives in this browser, so a presenter tab and a phone
// tab on the same machine can be tried against each other.

export interface DemoWorkshop extends WorkshopSummary {
  index: number;
  revealed: boolean;
  votes: Record<string, Record<string, readonly string[]>>; // question -> participant -> choices
  hidden?: Record<string, readonly string[]>;
}

const demoAll = (): DemoWorkshop[] => readJson<DemoWorkshop[]>(STORAGE_KEYS.demoWorkshops) ?? [];
const demoSave = (all: readonly DemoWorkshop[]): void => writeJson(STORAGE_KEYS.demoWorkshops, all);

/** The same rules as the database function, so demo mode cannot mislead. */
export const stateFrom = (workshop: DemoWorkshop): LiveWorkshop => {
  const questionId = workshop.questionIds[workshop.index] ?? null;
  const votes = questionId === null ? {} : (workshop.votes[questionId] ?? {});
  const answered = Object.keys(votes).length;
  const hidden = questionId === null ? [] : [...(workshop.hidden?.[questionId] ?? [])];
  let results: Record<string, number> | null = null;
  if (workshop.revealed && answered >= MIN_ANSWERS) {
    results = {};
    for (const choices of Object.values(votes)) {
      // Each person counts once per choice, however they typed it.
      for (const choice of new Set(choices.map((c) => c.trim().toLowerCase()))) {
        if (!hidden.includes(choice)) results[choice] = (results[choice] ?? 0) + 1;
      }
    }
  }
  return {
    found: true,
    id: workshop.id,
    title: workshop.title,
    roundId: workshop.roundId,
    status: workshop.status,
    questionIds: [...workshop.questionIds],
    index: workshop.index,
    questionId,
    revealed: workshop.revealed,
    answered,
    minAnswers: MIN_ANSWERS,
    results,
    hidden,
  };
};

// ---------------------------------------------------------------------------

export const getWorkshopState = async (code: string): Promise<WorkshopState | null> => {
  const supabase = getSupabase();
  if (supabase === null) {
    const workshop = demoAll().find((item) => item.code === normaliseCode(code));
    return workshop === undefined ? { found: false } : stateFrom(workshop);
  }
  const { data, error } = await supabase.rpc('workshop_state', { p_code: normaliseCode(code) });
  if (error !== null) return null;
  const parsed = stateSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
};

export type VoteOutcome = 'ok' | 'not_found' | 'closed' | 'not_current' | 'revealed' | 'invalid' | 'full' | 'offline';

export const castVote = async (
  code: string,
  participant: string,
  questionId: string,
  choices: readonly string[],
): Promise<VoteOutcome> => {
  if (choices.length === 0) return 'invalid';
  const supabase = getSupabase();
  if (supabase === null) {
    const all = demoAll();
    const workshop = all.find((item) => item.code === normaliseCode(code));
    if (workshop === undefined) return 'not_found';
    if (workshop.status !== 'open') return 'closed';
    if (workshop.questionIds[workshop.index] !== questionId) return 'not_current';
    if (workshop.revealed) return 'revealed';
    workshop.votes[questionId] = { ...(workshop.votes[questionId] ?? {}), [participant]: [...choices] };
    demoSave(all);
    return 'ok';
  }
  const { data, error } = await supabase.rpc('cast_workshop_vote', {
    p_code: normaliseCode(code),
    p_participant: participant,
    p_question_id: questionId,
    p_choices: [...choices],
  });
  if (error !== null) return 'offline';
  return typeof data === 'string' ? (data as VoteOutcome) : 'offline';
};

export const createWorkshop = async (input: {
  readonly title: string;
  readonly roundId: string;
  readonly questionIds: readonly string[];
  readonly createdBy: string;
}): Promise<Result<WorkshopSummary>> => {
  const title = input.title.trim();
  if (title.length === 0) return { success: false, error: 'Give the workshop a name people will recognise.' };
  if (input.questionIds.length === 0) return { success: false, error: 'Choose at least one question.' };

  const supabase = getSupabase();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const summary: WorkshopSummary = {
      id: crypto.randomUUID(),
      code: newWorkshopCode(),
      title,
      roundId: input.roundId,
      status: 'open',
      questionIds: [...input.questionIds],
      createdAt: new Date().toISOString(),
    };
    if (supabase === null) {
      const all = demoAll();
      if (all.some((item) => item.code === summary.code)) continue;
      demoSave([{ ...summary, index: 0, revealed: false, votes: {} }, ...all]);
      return { success: true, data: summary };
    }
    const { error } = await supabase.from(WORKSHOPS_TABLE).insert({
      id: summary.id,
      project_id: currentProject().id,
      code: summary.code,
      title,
      round_id: summary.roundId,
      question_ids: summary.questionIds,
      created_by: input.createdBy,
    });
    if (error === null) return { success: true, data: summary };
    // 23505: the code is taken. Anything else is a real failure.
    if (error.code !== '23505') return { success: false, error: error.message };
  }
  return { success: false, error: 'Could not find a free join code. Try again.' };
};

export interface WorkshopControl {
  readonly index?: number;
  readonly revealed?: boolean;
  readonly status?: 'open' | 'closed';
}

export const controlWorkshop = async (id: string, change: WorkshopControl): Promise<Result<true>> => {
  const supabase = getSupabase();
  if (supabase === null) {
    const all = demoAll();
    const workshop = all.find((item) => item.id === id);
    if (workshop === undefined) return { success: false, error: 'That workshop no longer exists.' };
    Object.assign(workshop, change);
    demoSave(all);
    return { success: true, data: true };
  }
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (change.index !== undefined) row.current_index = change.index;
  if (change.revealed !== undefined) row.revealed = change.revealed;
  if (change.status !== undefined) row.status = change.status;
  const { error } = await supabase.from(WORKSHOPS_TABLE).update(row).eq('id', id);
  return error === null ? { success: true, data: true } : { success: false, error: error.message };
};

/** Takes a word off the screen, or puts it back. Applies to every result the room sees. */
export const setWordHidden = async (
  id: string,
  questionId: string,
  word: string,
  hide: boolean,
): Promise<Result<true>> => {
  const target = word.trim().toLowerCase();
  const next = (current: readonly string[]): string[] =>
    hide ? [...new Set([...current, target])] : current.filter((item) => item !== target);
  const supabase = getSupabase();
  if (supabase === null) {
    const all = demoAll();
    const workshop = all.find((item) => item.id === id);
    if (workshop === undefined) return { success: false, error: 'That workshop no longer exists.' };
    workshop.hidden = { ...(workshop.hidden ?? {}), [questionId]: next(workshop.hidden?.[questionId] ?? []) };
    demoSave(all);
    return { success: true, data: true };
  }
  const { data, error: readError } = await supabase.from(WORKSHOPS_TABLE).select('hidden').eq('id', id).single();
  if (readError !== null) return { success: false, error: readError.message };
  const hidden = (data as { hidden: Record<string, string[]> | null }).hidden ?? {};
  const { error } = await supabase
    .from(WORKSHOPS_TABLE)
    .update({ hidden: { ...hidden, [questionId]: next(hidden[questionId] ?? []) }, updated_at: new Date().toISOString() })
    .eq('id', id);
  return error === null ? { success: true, data: true } : { success: false, error: error.message };
};

export const listWorkshops = async (): Promise<readonly WorkshopSummary[]> => {
  const supabase = getSupabase();
  if (supabase === null) return demoAll();
  const { data, error } = await supabase
    .from(WORKSHOPS_TABLE)
    .select('id, code, title, round_id, status, question_ids, created_at')
    .eq('project_id', currentProject().id)
    .order('created_at', { ascending: false });
  if (error !== null || data === null) return [];
  return (
    data as {
      id: string;
      code: string;
      title: string;
      round_id: string;
      status: 'open' | 'closed';
      question_ids: string[];
      created_at: string;
    }[]
  ).map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    roundId: row.round_id,
    status: row.status,
    questionIds: row.question_ids,
    createdAt: row.created_at,
  }));
};

export const joinUrl = (code: string, base: string = `${window.location.origin}${window.location.pathname}`): string =>
  `${base}#/w/${code}`;

export interface TallyRow {
  readonly id: string;
  readonly label: string;
  readonly hands: number;
  /** Of the people who answered this question. */
  readonly share: number;
}

export const tallyRows = (question: ChoiceQuestion, results: Readonly<Record<string, number>>, answered: number) =>
  workshopChoices(question)
    .map((option): TallyRow => {
      const hands = results[option.id] ?? 0;
      return { id: option.id, label: option.label, hands, share: answered === 0 ? 0 : hands / answered };
    })
    .sort((a, b) => b.hands - a.hands);

export interface RatingRow {
  readonly id: string;
  readonly label: string;
  /** How many people gave each score, 1 to 5. */
  readonly scores: readonly number[];
  readonly rated: number;
  readonly mean: number;
  /** Of those who rated it, the share giving 4 or 5. */
  readonly high: number;
}

/** Average and spread per row, highest average first. Rows nobody rated go last. */
export const ratingRows = (question: RatingQuestion, results: Readonly<Record<string, number>>): readonly RatingRow[] =>
  question.rows
    .map((row): RatingRow => {
      const scores = [1, 2, 3, 4, 5].map((score) => results[`${row.id}=${score}`] ?? 0);
      const rated = scores.reduce((sum, count) => sum + count, 0);
      const total = scores.reduce((sum, count, index) => sum + count * (index + 1), 0);
      return {
        id: row.id,
        label: row.label,
        scores,
        rated,
        mean: rated === 0 ? 0 : total / rated,
        high: rated === 0 ? 0 : ((scores[3] ?? 0) + (scores[4] ?? 0)) / rated,
      };
    })
    .sort((a, b) => b.mean - a.mean || b.rated - a.rated);

export interface CloudWord {
  readonly word: string;
  readonly count: number;
}

export const cloudWords = (results: Readonly<Record<string, number>>, limit = 40): readonly CloudWord[] =>
  Object.entries(results)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);

/**
 * One phone's answers, as an ordinary response. Only questions actually
 * answered appear; an unanswered question is absent, never an empty answer.
 */
export const answersFromVotes = (
  questionnaire: Questionnaire,
  votes: Readonly<Record<string, readonly string[]>>,
): AnswerMap => {
  const answers: Record<string, Answer> = {};
  for (const [questionId, choices] of Object.entries(votes)) {
    const question = questionById(questionnaire, questionId);
    if (question === undefined || choices.length === 0) continue;
    if (question.kind === 'single') answers[questionId] = { kind: 'single', value: choices[0] ?? '' };
    else if (question.kind === 'multi') answers[questionId] = { kind: 'multi', values: [...choices] };
    else if (question.kind === 'rank') answers[questionId] = { kind: 'rank', values: choices.slice(0, question.count) };
    else if (question.kind === 'rating') {
      const rows = new Set(question.rows.map((row) => row.id));
      const values = Object.fromEntries(Object.entries(decodeRating(choices)).filter(([row]) => rows.has(row)));
      if (Object.keys(values).length > 0) answers[questionId] = { kind: 'rating', values };
    } else {
      const words = cleanWords(choices);
      if (words.length > 0) answers[questionId] = { kind: 'text', value: words.join('; ') };
    }
  }
  return answers;
};

/** What a phone keeps between reloads, per workshop. */
export interface ParticipantState {
  readonly participant: string;
  readonly role: string | null;
  readonly startedAt: string;
  readonly votes: Readonly<Record<string, readonly string[]>>;
  readonly submitted: boolean;
}

const participantKey = (code: string): string => `${STORAGE_KEYS.workshopParticipant}.${normaliseCode(code)}`;

export const loadParticipant = (code: string): ParticipantState | null => readJson<ParticipantState>(participantKey(code));

export const saveParticipant = (code: string, state: ParticipantState): void => writeJson(participantKey(code), state);
