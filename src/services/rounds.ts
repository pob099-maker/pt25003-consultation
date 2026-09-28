import { getSupabase } from '../lib/supabase';
import { STORAGE_KEYS, readJson, removeKey, writeJson } from '../lib/storage';
import { currentProject } from '../content/projects';
import { DEMO_ROUNDS } from './demoData';
import { roundProblems, type QuestionOverride, type RoundConfig } from './roundRules';
import type { Result, RoundStage } from '../types';

export const ROUNDS_TABLE = 'consultation_rounds';

export {
  applyRound,
  everyRow,
  isWatchList,
  newRowId,
  newRowSchema,
  nextRoundOverrides,
  reportingFrame,
  roundProblems,
  rowsAsked,
  type NewRow,
  type QuestionOverride,
  type RoundConfig,
  type RoundContext,
} from './roundRules';

/** Saves a round in one transaction; see supabase/migrations/0015_save_round.sql. */
export const SAVE_ROUND_FUNCTION = 'save_consultation_round';

/** PostgREST's "no such function": the database is a migration behind the code. */
const MISSING_FUNCTION = 'PGRST202';

interface RoundRow {
  round_id: string;
  label: string;
  stage: RoundStage | null;
  is_active: boolean;
  overrides: Record<string, QuestionOverride> | null;
}

const fromRow = (row: RoundRow): RoundConfig => ({
  roundId: row.round_id,
  label: row.label,
  stage: row.stage ?? 'baseline',
  isActive: row.is_active,
  overrides: row.overrides ?? {},
});

/**
 * What the server says is live: a round, or nothing configured (in which case
 * the questions compiled into the app are the live ones, as they are with no
 * backend at all). Unreachable is kept apart from "nothing live", because a
 * phone with no signal must not be told the questions have changed.
 */
export type ActiveRound =
  | { readonly state: 'live'; readonly round: RoundConfig | null }
  | { readonly state: 'unreachable' };

export const fetchActiveRound = async (): Promise<ActiveRound> => {
  const supabase = getSupabase();
  if (supabase === null) return { state: 'live', round: null };
  try {
    const { data, error } = await supabase
      .from(ROUNDS_TABLE)
      .select('round_id, label, stage, is_active, overrides')
      .eq('project_id', currentProject().id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (error !== null) return { state: 'unreachable' };
    return { state: 'live', round: data === null ? null : fromRow(data as RoundRow) };
  } catch {
    return { state: 'unreachable' };
  }
};

interface CachedRound {
  readonly projectId: string;
  readonly round: RoundConfig;
}

/** The live round as last seen on this device, for this project. */
export const cachedActiveRound = (): RoundConfig | null => {
  const cached = readJson<CachedRound>(STORAGE_KEYS.activeRound);
  if (cached === null || cached.projectId !== currentProject().id || typeof cached.round?.roundId !== 'string') return null;
  return { ...cached.round, overrides: cached.round.overrides ?? {} };
};

export const rememberActiveRound = (round: RoundConfig | null): void => {
  if (round === null) removeKey(STORAGE_KEYS.activeRound);
  else writeJson(STORAGE_KEYS.activeRound, { projectId: currentProject().id, round } satisfies CachedRound);
};

/** The active round, or null when there is none or it cannot be read. */
export const loadActiveRound = async (): Promise<RoundConfig | null> => {
  const result = await fetchActiveRound();
  return result.state === 'live' ? result.round : null;
};

/** The demonstration's own rounds, so change over time has something to show without a database. */
const demoRounds = (): readonly RoundConfig[] =>
  DEMO_ROUNDS.map((round) => ({ ...round, isActive: round.stage === 'review', overrides: round.overrides ?? {} }));

/** Every round of the project, oldest first, or why they could not be read. */
export const fetchAllRounds = async (): Promise<Result<readonly RoundConfig[]>> => {
  const supabase = getSupabase();
  if (supabase === null) return { success: true, data: demoRounds() };
  try {
    const { data, error } = await supabase
      .from(ROUNDS_TABLE)
      .select('round_id, label, stage, is_active, overrides, created_at')
      .eq('project_id', currentProject().id)
      .order('created_at', { ascending: true });
    if (error !== null || data === null) return { success: false, error: error?.message ?? 'No rounds came back.' };
    return { success: true, data: (data as RoundRow[]).map(fromRow) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'The rounds could not be read.' };
  }
};

export const loadAllRounds = async (): Promise<readonly RoundConfig[]> => {
  const result = await fetchAllRounds();
  return result.success ? result.data : [];
};

/**
 * Saves a round, and when it is to collect responses, makes it the only one
 * that does, in one transaction: switching the others off and writing this
 * one happen together or not at all. Before, the others were switched off
 * first, so a write the database refused (a second starting point, or a
 * connection dropped in between) left the project with no live round, and the
 * public form fell back to the questions compiled into the app.
 */
export const saveRound = async (round: RoundConfig): Promise<string | null> => {
  const supabase = getSupabase();
  if (supabase === null) return 'No backend is configured, so the round could not be saved.';
  const problems = roundProblems(currentProject().questionnaire, round);
  if (problems.length > 0) return problems.join(' ');
  const { error } = await supabase.rpc(SAVE_ROUND_FUNCTION, {
    p_round_id: round.roundId,
    p_project_id: currentProject().id,
    p_label: round.label,
    p_stage: round.stage,
    p_is_active: round.isActive,
    p_overrides: round.overrides,
  });
  if (error === null) return null;
  if (error.code !== MISSING_FUNCTION) return error.message;
  return saveRoundInSteps(supabase, round);
};

/**
 * The same save for a database that does not have the function yet. The
 * round is written first without switching anything, so a refusal leaves the
 * live round alone; only then are the others switched off and this one on.
 */
const saveRoundInSteps = async (
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  round: RoundConfig,
): Promise<string | null> => {
  const projectId = currentProject().id;
  const { data: existing, error: readError } = await supabase
    .from(ROUNDS_TABLE)
    .select('is_active')
    .eq('round_id', round.roundId)
    .maybeSingle();
  if (readError !== null) return readError.message;
  const alreadyLive = (existing as { is_active?: boolean } | null)?.is_active === true;
  const { error: writeError } = await supabase.from(ROUNDS_TABLE).upsert(
    {
      round_id: round.roundId,
      project_id: projectId,
      label: round.label,
      stage: round.stage,
      is_active: alreadyLive && round.isActive,
      overrides: round.overrides,
    },
    { onConflict: 'round_id' },
  );
  if (writeError !== null) return writeError.message;
  if (!round.isActive || alreadyLive) return null;
  const { error: clearError } = await supabase
    .from(ROUNDS_TABLE)
    .update({ is_active: false })
    .eq('project_id', projectId)
    .neq('round_id', round.roundId);
  if (clearError !== null) return clearError.message;
  const { error: liveError } = await supabase
    .from(ROUNDS_TABLE)
    .update({ is_active: true })
    .eq('round_id', round.roundId);
  if (liveError !== null) return `${liveError.message} No round is collecting responses now: press Save again to switch this one on.`;
  return null;
};
