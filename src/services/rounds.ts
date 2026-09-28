import { getSupabase } from '../lib/supabase';
import { currentProject } from '../content/projects';
import { DEMO_ROUNDS } from './demoData';
import { applyRound, type QuestionOverride, type RoundConfig } from './roundRules';
import type { Questionnaire, RoundStage } from '../types';

export const ROUNDS_TABLE = 'consultation_rounds';

export {
  applyRound,
  asksFollowUp,
  everyRow,
  isWatchList,
  newRowId,
  newRowSchema,
  nextRoundOverrides,
  reportingFrame,
  type NewRow,
  type QuestionOverride,
  type RoundConfig,
  type RoundDefinition,
} from './roundRules';

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
 * The active round, or null when there is no backend or no configured round.
 * Callers fall back to the questionnaire compiled into the bundle, so the
 * consultation never depends on this call succeeding.
 */
export const loadActiveRound = async (): Promise<RoundConfig | null> => {
  const supabase = getSupabase();
  if (supabase === null) return null;
  const { data, error } = await supabase
    .from(ROUNDS_TABLE)
    .select('round_id, label, stage, is_active, overrides')
    .eq('project_id', currentProject().id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (error !== null || data === null) return null;
  const row = data as RoundRow;
  return fromRow(row);
};

export const loadAllRounds = async (): Promise<readonly RoundConfig[]> => {
  const supabase = getSupabase();
  // No database: the demo's own baseline and review, so change over time has something to show.
  if (supabase === null)
    return DEMO_ROUNDS.map((round) => ({ ...round, isActive: round.stage === 'review', overrides: round.overrides ?? {} }));
  const { data, error } = await supabase
    .from(ROUNDS_TABLE)
    .select('round_id, label, stage, is_active, overrides, created_at')
    .eq('project_id', currentProject().id)
    .order('created_at', { ascending: true });
  if (error !== null || data === null) return [];
  return (data as RoundRow[]).map(fromRow);
};

export const saveRound = async (round: RoundConfig): Promise<string | null> => {
  const supabase = getSupabase();
  if (supabase === null) return 'No backend is configured, so the round could not be saved.';
  if (round.isActive) {
    // Exactly one round collects responses at a time.
    const { error: clearError } = await supabase
      .from(ROUNDS_TABLE)
      .update({ is_active: false })
      .eq('project_id', currentProject().id)
      .neq('round_id', round.roundId);
    if (clearError !== null) return clearError.message;
  }
  const { error } = await supabase.from(ROUNDS_TABLE).upsert(
    {
      round_id: round.roundId,
      project_id: currentProject().id,
      label: round.label,
      stage: round.stage,
      is_active: round.isActive,
      overrides: round.overrides,
    },
    { onConflict: 'round_id' },
  );
  return error === null ? null : error.message;
};

export const activeQuestionnaire = async (): Promise<Questionnaire> => {
  const round = await loadActiveRound();
  const base = currentProject().questionnaire;
  return round === null ? base : applyRound(base, round);
};
