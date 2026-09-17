import { currentProject } from '../content/projects';
import { getSupabase } from '../lib/supabase';
import { STORAGE_KEYS, readJson, removeKey, writeJson } from '../lib/storage';
import type { RoleId } from '../types';

export const PROGRESS_TABLE = 'consultation_progress';
export const PROGRESS_FUNCTION = 'record_consultation_progress';

export interface ProgressPing {
  readonly id: string;
  readonly roundId: string;
  readonly role: RoleId | null;
  readonly pathway: string | null;
  readonly stepIndex: number;
  readonly stepId: string;
  readonly stepCount: number;
  readonly startedAt: string;
  readonly completed: boolean;
}

export interface ProgressRow {
  id: string;
  round_id: string;
  role: string | null;
  pathway: string | null;
  furthest_step: number;
  furthest_step_id: string;
  step_count: number;
  completed: boolean;
  started_at: string;
  updated_at: string;
}

/**
 * Whether this person has let us record how far they get.
 *
 * Opt-out rather than opt-in, deliberately: the people who would tick "yes,
 * record me" are the engaged ones, who are the least likely to give up — so an
 * opt-in would measure drop-off only among people who do not drop off. The
 * record holds a step number and nothing typed, which makes on-by-default with
 * a plain off switch the proportionate choice.
 *
 * A browser sending Global Privacy Control is treated as having opted out
 * already. Nobody should have to find our switch after telling their browser
 * the same thing.
 */
export const isProgressAllowed = (state: { optedOut: boolean; globalPrivacyControl: boolean }): boolean =>
  !state.optedOut && !state.globalPrivacyControl;

const currentState = (): { optedOut: boolean; globalPrivacyControl: boolean } => ({
  optedOut: readJson<boolean>(STORAGE_KEYS.progressOptOut) === true,
  globalPrivacyControl:
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true,
});

export const progressAllowed = (): boolean => isProgressAllowed(currentState());

export const browserSaysDoNotTrack = (): boolean => currentState().globalPrivacyControl;

export const setProgressOptOut = (optedOut: boolean): void => {
  if (optedOut) writeJson(STORAGE_KEYS.progressOptOut, true);
  else removeKey(STORAGE_KEYS.progressOptOut);
};

/** The furthest step this session has reached, so going Back never rewinds it. */
const furthest = new Map<string, number>();

/**
 * Records where a session got to. Deliberately fire-and-forget: this is
 * instrumentation, and instrumentation must never be able to interrupt
 * somebody answering a question. Failures are swallowed, not queued — a lost
 * ping costs a row in a funnel chart, where a lost response costs somebody's
 * ten minutes.
 */
export const recordProgress = (ping: ProgressPing): void => {
  if (!progressAllowed()) return;
  const supabase = getSupabase();
  if (supabase === null) return;

  const seen = furthest.get(ping.id) ?? -1;
  if (ping.stepIndex <= seen && !ping.completed) return;
  furthest.set(ping.id, Math.max(seen, ping.stepIndex));

  // Through a database function, not a table write. Anonymous visitors cannot
  // read the progress table, and Postgres will not run an insert-or-update for
  // a caller that cannot read — so a direct upsert was refused every time.
  // The function enforces its own rules: a session only moves forward, and a
  // finished session is never changed. See migrations/0004.
  void supabase
    .rpc(PROGRESS_FUNCTION, {
      p_id: ping.id,
      p_round_id: ping.roundId,
      p_role: ping.role,
      p_pathway: ping.pathway,
      p_furthest_step: Math.max(seen, ping.stepIndex),
      p_furthest_step_id: ping.stepId,
      p_step_count: ping.stepCount,
      p_completed: ping.completed,
      p_started_at: ping.startedAt,
    })
    .then(
      ({ error }) => {
        // Still never shown to the respondent — but no longer silent. A
        // swallowed error is how this recorded nothing for its first week.
        if (error !== null) console.warn('Progress not recorded:', error.message);
      },
      (error: unknown) => console.warn('Progress not recorded:', error),
    );
};

export interface DropOff {
  readonly stepId: string;
  readonly stepIndex: number;
  readonly reached: number;
  readonly stopped: number;
}

export interface ProgressSummary {
  readonly started: number;
  readonly completed: number;
  readonly completionRate: number;
  readonly byPathway: readonly { pathway: string; started: number; completed: number; rate: number }[];
  readonly dropOff: readonly DropOff[];
}

const round2 = (value: number): number => Number(value.toFixed(2));

export const summariseProgress = (rows: readonly ProgressRow[]): ProgressSummary => {
  const started = rows.length;
  const completed = rows.filter((row) => row.completed).length;

  const pathways = new Map<string, { started: number; completed: number }>();
  for (const row of rows) {
    const key = row.pathway ?? 'not chosen';
    const current = pathways.get(key) ?? { started: 0, completed: 0 };
    pathways.set(key, { started: current.started + 1, completed: current.completed + (row.completed ? 1 : 0) });
  }

  // "Stopped here" counts only sessions that did not finish, so a step every
  // completed respondent passed through does not look like a wall.
  const steps = new Map<string, { index: number; reached: number; stopped: number }>();
  for (const row of rows) {
    const key = row.furthest_step_id.length > 0 ? row.furthest_step_id : `step ${row.furthest_step + 1}`;
    const current = steps.get(key) ?? { index: row.furthest_step, reached: 0, stopped: 0 };
    steps.set(key, {
      index: row.furthest_step,
      reached: current.reached + 1,
      stopped: current.stopped + (row.completed ? 0 : 1),
    });
  }

  return {
    started,
    completed,
    completionRate: started === 0 ? 0 : round2(completed / started),
    byPathway: [...pathways.entries()]
      .map(([pathway, value]) => ({
        pathway,
        started: value.started,
        completed: value.completed,
        rate: value.started === 0 ? 0 : round2(value.completed / value.started),
      }))
      .sort((a, b) => b.started - a.started),
    dropOff: [...steps.entries()]
      .map(([stepId, value]) => ({ stepId, stepIndex: value.index, reached: value.reached, stopped: value.stopped }))
      .sort((a, b) => a.stepIndex - b.stepIndex),
  };
};

export const loadProgress = async (): Promise<readonly ProgressRow[]> => {
  const supabase = getSupabase();
  if (supabase === null) return [];
  const { data, error } = await supabase.from(PROGRESS_TABLE).select('*').eq('project_id', currentProject().id);
  if (error !== null || data === null) return [];
  return data as ProgressRow[];
};
