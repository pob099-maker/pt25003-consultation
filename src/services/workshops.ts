import { z } from 'zod';
import { getSupabase } from '../lib/supabase';
import { STORAGE_KEYS, readJson, writeJson } from '../lib/storage';
import { questionById } from '../content/lookup';
import type { Answer, AnswerMap, Option, Question, Questionnaire, Result } from '../types';
import { groupQuestions } from './groups';

export const WORKSHOPS_TABLE = 'consultation_workshops';

/** Results stay hidden until this many people have answered. Matches the database. */
export const MIN_ANSWERS = 5;

/** No 0/O or 1/I, so a code read off a projector is typed correctly first time. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const newWorkshopCode = (random: () => number = Math.random): string =>
  Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]).join('');

export const normaliseCode = (raw: string): string => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

export type WorkshopQuestion = Extract<Question, { kind: 'multi' | 'single' | 'rank' }>;

/**
 * What can be answered by tapping on a phone in a room. Ratings and free text
 * are left out: a grid of sliders is slow on a phone while a presenter waits,
 * and free text needs a facilitator, not a bar chart.
 */
export const workshopQuestions = (questionnaire: Questionnaire): readonly WorkshopQuestion[] =>
  groupQuestions(questionnaire).filter(
    (question): question is WorkshopQuestion =>
      question.kind === 'multi' || question.kind === 'single' || question.kind === 'rank',
  );

export const workshopChoices = (question: WorkshopQuestion): readonly Option[] =>
  question.kind === 'rank' ? question.fallbackOptions : question.options;

export const maxChoices = (question: WorkshopQuestion): number => {
  if (question.kind === 'single') return 1;
  if (question.kind === 'rank') return question.count;
  return question.options.length;
};

export const choiceHint = (question: WorkshopQuestion): string => {
  if (question.kind === 'single') return 'Pick one.';
  if (question.kind === 'rank') return `Pick up to ${question.count}, most important first.`;
  return 'Pick all that apply.';
};

/** Tapping adds or removes; a single-choice question swaps; a full ranking refuses more. */
export const toggleChoice = (question: WorkshopQuestion, current: readonly string[], id: string): readonly string[] => {
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
}

const demoAll = (): DemoWorkshop[] => readJson<DemoWorkshop[]>(STORAGE_KEYS.demoWorkshops) ?? [];
const demoSave = (all: readonly DemoWorkshop[]): void => writeJson(STORAGE_KEYS.demoWorkshops, all);

/** The same rules as the database function, so demo mode cannot mislead. */
export const stateFrom = (workshop: DemoWorkshop): LiveWorkshop => {
  const questionId = workshop.questionIds[workshop.index] ?? null;
  const votes = questionId === null ? {} : (workshop.votes[questionId] ?? {});
  const answered = Object.keys(votes).length;
  let results: Record<string, number> | null = null;
  if (workshop.revealed && answered >= MIN_ANSWERS) {
    results = {};
    for (const choices of Object.values(votes)) {
      for (const choice of choices) results[choice] = (results[choice] ?? 0) + 1;
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

export const listWorkshops = async (): Promise<readonly WorkshopSummary[]> => {
  const supabase = getSupabase();
  if (supabase === null) return demoAll();
  const { data, error } = await supabase
    .from(WORKSHOPS_TABLE)
    .select('id, code, title, round_id, status, question_ids, created_at')
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

export const tallyRows = (question: WorkshopQuestion, results: Readonly<Record<string, number>>, answered: number) =>
  workshopChoices(question)
    .map((option): TallyRow => {
      const hands = results[option.id] ?? 0;
      return { id: option.id, label: option.label, hands, share: answered === 0 ? 0 : hands / answered };
    })
    .sort((a, b) => b.hands - a.hands);

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
