import { getSupabase } from '../lib/supabase';
import { currentProject } from '../content/projects';
import { libraryQuestion } from '../content/library';
import { allQuestions } from '../content/lookup';
import type { Option, Question, Questionnaire, RoundStage, Section } from '../types';

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
}

export interface RoundConfig {
  readonly roundId: string;
  readonly label: string;
  readonly stage: RoundStage;
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
  if (override === undefined || question.tracking === true) return question;
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

const applyToSection = (
  section: Section,
  overrides: RoundConfig['overrides'],
  existing: ReadonlySet<string>,
): Section => {
  const added = Object.entries(overrides)
    .filter(([id, override]) => override.addTo === section.id && !existing.has(id))
    .map(([id]) => libraryQuestion(id))
    .filter((question): question is Question => question !== undefined);
  return {
    ...section,
    questions: [...section.questions, ...added]
      .filter((question) => !isRetired(question, overrides[question.id]))
      .map((question) => applyToQuestion(question, overrides[question.id])),
  };
};

export const applyRound = (base: Questionnaire, round: RoundConfig): Questionnaire => {
  const existing = new Set(allQuestions(base).map((question) => question.id));
  const apply = (section: Section): Section => applyToSection(section, round.overrides, existing);
  return {
    ...base,
    roundId: round.roundId,
    roundLabel: round.label,
    stage: round.stage,
    core: base.core.map(apply),
    followUp: base.followUp.map(apply),
    pathways: Object.fromEntries(Object.entries(base.pathways).map(([key, section]) => [key, apply(section)])),
    projectDesign: base.projectDesign.map(apply),
  };
};

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
  if (supabase === null) return [];
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
