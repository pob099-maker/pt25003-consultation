import { STORAGE_KEYS, readJson, writeJson } from '../lib/storage';
import type { Draft } from '../hooks/useConsultation';
import type { CollectionMethod } from '../types';
import type { FormLength } from './formLength';

/**
 * An interview stopped part-way, to ring back and finish: the way a grower on
 * a tractor gives three minutes now and three on Thursday.
 *
 * Nothing is sent until the call is finished, so a paused call never reaches
 * the results as half an answer set. It stays on the phone it was taken on,
 * with a note the interviewer writes to find the person again. The note is the
 * only thing here that could say who somebody is, which is why it is never
 * sent, and goes when the call is finished or thrown away.
 */

export type InterviewMethod = Extract<CollectionMethod, `interview_${string}`>;

export interface InterviewSetup {
  readonly method: InterviewMethod;
  readonly consent: true;
  /** Absent on a setup saved before short calls existed: that was a full interview. */
  readonly length?: FormLength;
}

export type RingBack = 'today' | 'tomorrow' | 'days' | 'week';

export const RING_BACK: readonly { readonly id: RingBack; readonly label: string; readonly days: number }[] = [
  { id: 'today', label: 'Later today', days: 0 },
  { id: 'tomorrow', label: 'Tomorrow', days: 1 },
  { id: 'days', label: 'In a few days', days: 3 },
  { id: 'week', label: 'Next week', days: 7 },
];

export const NOTE_LENGTH = 160;

export interface PausedCall {
  /** The draft's own response id, so the finished call is still stored once. */
  readonly id: string;
  /** Who took it. Only they are offered it back. */
  readonly staffId: string;
  readonly setup: InterviewSetup;
  readonly draft: Draft;
  /** Kept on this phone only. Never sent with the answers. */
  readonly note: string;
  readonly ringBack: RingBack;
  readonly pausedAt: string;
  /** Talking time so far, so a call finished days later records its minutes, not the days between. */
  readonly activeSeconds: number;
  readonly stepTitle: string;
  readonly stepNumber: number;
  readonly stepCount: number;
}

const isCall = (value: unknown): value is PausedCall => {
  if (value === null || typeof value !== 'object') return false;
  const call = value as Partial<PausedCall>;
  return (
    typeof call.id === 'string' &&
    typeof call.staffId === 'string' &&
    typeof call.pausedAt === 'string' &&
    typeof call.activeSeconds === 'number' &&
    call.draft !== undefined &&
    typeof call.draft?.roundId === 'string' &&
    call.setup !== undefined &&
    typeof call.setup?.method === 'string'
  );
};

const readAll = (): readonly PausedCall[] => {
  const saved = readJson<unknown>(STORAGE_KEYS.pausedCalls);
  return Array.isArray(saved) ? saved.filter(isCall) : [];
};

/** This interviewer's paused calls, the longest waiting first. */
export const pausedFor = (staffId: string): readonly PausedCall[] =>
  readAll()
    .filter((call) => call.staffId === staffId)
    .sort((a, b) => a.pausedAt.localeCompare(b.pausedAt));

/** The schema's ceiling on a response's duration. */
const LONGEST = 60 * 60 * 24;

/** Talking time from a draft's start, which a resumed call has already moved up to the earlier pieces. */
export const talkingSeconds = (draft: Pick<Draft, 'startedAt'>, now: Date): number =>
  Math.min(LONGEST, Math.max(0, Math.round((now.getTime() - new Date(draft.startedAt).getTime()) / 1000)));

export const pauseCall = (call: PausedCall): void =>
  writeJson(STORAGE_KEYS.pausedCalls, [...readAll().filter((held) => held.id !== call.id), call]);

/** Off the list: picked up again, or thrown away. */
export const removePaused = (id: string): void =>
  writeJson(
    STORAGE_KEYS.pausedCalls,
    readAll().filter((held) => held.id !== id),
  );

/**
 * The draft to carry on with. Its start is moved up to now, less the talking
 * time so far, so the finished call records how long the person actually
 * spent, rather than the days it sat waiting, which would also be refused as
 * longer than any call can be.
 */
export const resumedDraft = (call: PausedCall, now: Date = new Date()): Draft => ({
  ...call.draft,
  startedAt: new Date(now.getTime() - call.activeSeconds * 1000).toISOString(),
});

/**
 * Whether the call can still be finished. A call paused in a round that has
 * since closed asked questions the live round may not, so it cannot be put
 * into it, the same rule an online draft follows.
 */
export const stillOpen = (call: PausedCall, liveRoundId: string, live: boolean): boolean =>
  !live || !call.draft.roundConfirmed || call.draft.roundId === liveRoundId;

const DAY = 24 * 60 * 60 * 1000;

const daysBetween = (from: Date, to: Date): number => {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((end - start) / DAY);
};

/** "Paused yesterday · ring back today", in the interviewer's own words. */
export const waitingText = (call: PausedCall, now: Date = new Date()): string => {
  const paused = new Date(call.pausedAt);
  const ago = daysBetween(paused, now);
  const pausedWhen = ago <= 0 ? 'Paused today' : ago === 1 ? 'Paused yesterday' : `Paused ${ago} days ago`;
  const wanted = RING_BACK.find((option) => option.id === call.ringBack) ?? RING_BACK[0];
  const dueIn = (wanted?.days ?? 0) - ago;
  const due =
    dueIn <= 0 ? 'ring back now' : dueIn === 1 ? 'ring back tomorrow' : `ring back in ${dueIn} days`;
  return `${pausedWhen} · ${due}`;
};

/** "4 min so far" */
export const minutesText = (seconds: number): string => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min so far`;
};
