import { STORAGE_KEYS, readJson, removeKey, writeJson } from '../lib/storage';
import type { AnswerMap, ConsultationResponse, Questionnaire, RoleId } from '../types';
import { LINK_CODE_ID, isLinkCode } from './linkCode';
import { BITE_ID, biteAnswer, pathwayFor, type Bite } from './bites';

/**
 * What one phone remembers between bites, and nothing more.
 *
 * Who somebody is — their part of the industry and their growing areas — is
 * asked once, so every bite after the first is only its own questions. It is
 * sent with each bite, the way the short version sends it once, so each bite
 * can be read by role and area like any other answer.
 *
 * The bites already sent from this phone are listed so the same one is not
 * answered twice, and so the next can be offered. A follow-up code, once made,
 * goes with every later bite: it is what lets one person's bites be put back
 * together, and it is anonymous by construction. Everything here is cleared by
 * "Not you?", and a new round starts the list again.
 */

export interface BiteInProgress {
  readonly biteId: string;
  /** One id for the life of the bite, so pressing Send twice, or a resend from the outbox, stores it once. */
  readonly responseId: string;
  readonly startedAt: string;
  readonly answers: AnswerMap;
}

export interface BitePhone {
  readonly roundId: string;
  readonly role: RoleId | null;
  readonly regions: readonly string[];
  readonly regionOther: string;
  /** Bites sent from this phone in this round. */
  readonly done: readonly string[];
  /** The follow-up code made in a bite this round, if one was. */
  readonly linkCode: string | null;
  readonly current: BiteInProgress | null;
}

export const emptyPhone = (roundId: string): BitePhone => ({
  roundId,
  role: null,
  regions: [],
  regionOther: '',
  done: [],
  linkCode: null,
  current: null,
});

const strings = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** Whatever an older version of the app, or a damaged store, left behind, made safe. */
export const readPhone = (fallbackRoundId: string): BitePhone => {
  const saved = readJson<Partial<BitePhone>>(STORAGE_KEYS.bites);
  if (saved === null || typeof saved !== 'object' || typeof saved.roundId !== 'string') return emptyPhone(fallbackRoundId);
  const current = saved.current;
  return {
    roundId: saved.roundId,
    role: typeof saved.role === 'string' ? saved.role : null,
    regions: strings(saved.regions),
    regionOther: typeof saved.regionOther === 'string' ? saved.regionOther : '',
    done: strings(saved.done),
    linkCode: typeof saved.linkCode === 'string' && isLinkCode(saved.linkCode) ? saved.linkCode : null,
    current:
      current !== null &&
      typeof current === 'object' &&
      typeof current?.biteId === 'string' &&
      typeof current.responseId === 'string' &&
      typeof current.startedAt === 'string'
        ? { biteId: current.biteId, responseId: current.responseId, startedAt: current.startedAt, answers: current.answers ?? {} }
        : null,
  };
};

export const savePhone = (phone: BitePhone): void => writeJson(STORAGE_KEYS.bites, phone);

/** "Not you?": the next person on this phone starts with nothing of the last one's. */
export const forgetPhone = (): void => removeKey(STORAGE_KEYS.bites);

/**
 * Once the live round is known. The same round carries on. A new round starts
 * the list again and drops the follow-up code, which is asked for afresh each
 * round, but keeps who somebody is, which they confirm on every bite.
 */
export const settlePhone = (phone: BitePhone, liveRoundId: string): BitePhone =>
  phone.roundId === liveRoundId
    ? phone
    : { ...emptyPhone(liveRoundId), role: phone.role, regions: phone.regions, regionOther: phone.regionOther };

/** The bite being answered now: the one already begun on this phone, or a fresh start. */
export const beginBite = (phone: BitePhone, bite: Bite, now: Date = new Date()): BitePhone =>
  phone.current?.biteId === bite.id
    ? phone
    : {
        ...phone,
        current: { biteId: bite.id, responseId: crypto.randomUUID(), startedAt: now.toISOString(), answers: {} },
      };

/** The schema's own ceiling. A bite left open overnight still sends. */
const LONGEST = 60 * 60 * 24;

/**
 * A bite as a response. Only the bite's own questions are sent, with the
 * follow-up code if this phone has one, and the marker that keeps it out of
 * everything that counts people.
 */
export const biteResponse = (
  questionnaire: Questionnaire,
  phone: BitePhone,
  bite: Bite,
  source: string | null,
  now: Date = new Date(),
): ConsultationResponse | null => {
  const current = phone.current;
  if (current === null || current.biteId !== bite.id) return null;
  const asked = new Set(bite.questions.map((question) => question.id));
  const answers: Record<string, AnswerMap[string]> = Object.fromEntries(
    Object.entries(current.answers).filter(([id]) => asked.has(id)),
  );
  if (phone.linkCode !== null && !asked.has(LINK_CODE_ID)) answers[LINK_CODE_ID] = { kind: 'text', value: phone.linkCode };
  answers[BITE_ID] = biteAnswer(bite.id);
  const seconds = Math.round((now.getTime() - new Date(current.startedAt).getTime()) / 1000);
  return {
    id: current.responseId,
    roundId: questionnaire.roundId,
    role: phone.role,
    pathway: pathwayFor(questionnaire, phone.role),
    regions: phone.regions,
    regionOther: phone.regionOther,
    answers,
    startedAt: current.startedAt,
    submittedAt: now.toISOString(),
    durationSeconds: Math.min(LONGEST, Math.max(0, seconds)),
    isTestData: false,
    method: 'online',
    collectedBy: null,
    consentVerbal: null,
    sessionId: null,
    source,
  };
};

/** After a bite is sent: listed as done, and the code kept if this bite made one. */
export const finishBite = (phone: BitePhone, bite: Bite): BitePhone => {
  const code = phone.current?.answers[LINK_CODE_ID];
  const made = code?.kind === 'text' && isLinkCode(code.value) ? code.value : null;
  return {
    ...phone,
    done: phone.done.includes(bite.id) ? phone.done : [...phone.done, bite.id],
    linkCode: made ?? phone.linkCode,
    current: null,
  };
};
