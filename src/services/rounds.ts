import { getSupabase } from '../lib/supabase';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import type { Option, Question, Questionnaire, Section } from '../types';

export const ROUNDS_TABLE = 'consultation_rounds';

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
  readonly addedOptions?: readonly Option[];
}

export interface RoundConfig {
  readonly roundId: string;
  readonly label: string;
  readonly isActive: boolean;
  readonly overrides: Readonly<Record<string, QuestionOverride>>;
}

const applyToOptions = (
  options: readonly Option[],
  override: QuestionOverride | undefined,
): readonly Option[] => {
  if (override === undefined) return options;
  const renamed = options.map((option) => {
    const label = override.optionLabels?.[option.id];
    return label === undefined ? option : { ...option, label };
  });
  return [...renamed, ...(override.addedOptions ?? [])];
};

const applyToQuestion = (question: Question, override: QuestionOverride | undefined): Question => {
  if (override === undefined) return question;
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

const applyToSection = (section: Section, overrides: RoundConfig['overrides']): Section => ({
  ...section,
  questions: section.questions.map((question) => applyToQuestion(question, overrides[question.id])),
});

export const applyRound = (base: Questionnaire, round: RoundConfig): Questionnaire => ({
  ...base,
  roundId: round.roundId,
  roundLabel: round.label,
  core: base.core.map((section) => applyToSection(section, round.overrides)),
  pathways: Object.fromEntries(
    Object.entries(base.pathways).map(([key, section]) => [key, applyToSection(section, round.overrides)]),
  ),
  projectDesign: base.projectDesign.map((section) => applyToSection(section, round.overrides)),
});

interface RoundRow {
  round_id: string;
  label: string;
  is_active: boolean;
  overrides: Record<string, QuestionOverride> | null;
}

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
    .select('round_id, label, is_active, overrides')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (error !== null || data === null) return null;
  const row = data as RoundRow;
  return { roundId: row.round_id, label: row.label, isActive: row.is_active, overrides: row.overrides ?? {} };
};

export const loadAllRounds = async (): Promise<readonly RoundConfig[]> => {
  const supabase = getSupabase();
  if (supabase === null) return [];
  const { data, error } = await supabase.from(ROUNDS_TABLE).select('round_id, label, is_active, overrides');
  if (error !== null || data === null) return [];
  return (data as RoundRow[]).map((row) => ({
    roundId: row.round_id,
    label: row.label,
    isActive: row.is_active,
    overrides: row.overrides ?? {},
  }));
};

export const saveRound = async (round: RoundConfig): Promise<string | null> => {
  const supabase = getSupabase();
  if (supabase === null) return 'No backend is configured, so the round could not be saved.';
  if (round.isActive) {
    // Exactly one round collects responses at a time.
    const { error: clearError } = await supabase
      .from(ROUNDS_TABLE)
      .update({ is_active: false })
      .neq('round_id', round.roundId);
    if (clearError !== null) return clearError.message;
  }
  const { error } = await supabase.from(ROUNDS_TABLE).upsert(
    {
      round_id: round.roundId,
      label: round.label,
      is_active: round.isActive,
      overrides: round.overrides,
    },
    { onConflict: 'round_id' },
  );
  return error === null ? null : error.message;
};

export const activeQuestionnaire = async (): Promise<Questionnaire> => {
  const round = await loadActiveRound();
  return round === null ? DEFAULT_QUESTIONNAIRE : applyRound(DEFAULT_QUESTIONNAIRE, round);
};
