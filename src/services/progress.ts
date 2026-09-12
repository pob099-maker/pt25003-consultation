import { getSupabase } from '../lib/supabase';
import type { RoleId } from '../types';

export const PROGRESS_TABLE = 'consultation_progress';

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
  const supabase = getSupabase();
  if (supabase === null) return;

  const seen = furthest.get(ping.id) ?? -1;
  if (ping.stepIndex <= seen && !ping.completed) return;
  furthest.set(ping.id, Math.max(seen, ping.stepIndex));

  const row: ProgressRow = {
    id: ping.id,
    round_id: ping.roundId,
    role: ping.role,
    pathway: ping.pathway,
    furthest_step: Math.max(seen, ping.stepIndex),
    furthest_step_id: ping.stepId,
    step_count: ping.stepCount,
    completed: ping.completed,
    started_at: ping.startedAt,
    updated_at: new Date().toISOString(),
  };

  void supabase
    .from(PROGRESS_TABLE)
    .upsert(row, { onConflict: 'id' })
    .then(() => undefined, () => undefined);
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
  const { data, error } = await supabase.from(PROGRESS_TABLE).select('*');
  if (error !== null || data === null) return [];
  return data as ProgressRow[];
};
