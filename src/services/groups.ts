import { z } from 'zod';
import { getSupabase } from '../lib/supabase';
import { STORAGE_KEYS, readJson, writeJson } from '../lib/storage';
import { allQuestions, optionLabel, questionById } from '../content/lookup';
import { toCsv } from '../lib/csv';
import type { Question, Questionnaire, Result } from '../types';

export const GROUPS_TABLE = 'consultation_group_records';

/**
 * A room, not a person.
 *
 * A show of hands from twelve growers is neither twelve responses nor one, so
 * a group discussion is kept as its own record — how many were present, and
 * how many hands went up — and reported beside individual answers, never
 * added to them.
 */
export interface GroupRecord {
  readonly id: string;
  readonly roundId: string;
  readonly title: string;
  readonly region: string;
  /** yyyy-mm-dd */
  readonly heldOn: string;
  readonly present: number;
  /** Role id to the rough number of that role in the room. */
  readonly roles: Readonly<Record<string, number>>;
  /** Question id to option id to hands. Absent means not asked, not zero. */
  readonly counts: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** Question id to what the room said. */
  readonly notes: Readonly<Record<string, string>>;
  readonly collectedBy: string;
  readonly updatedAt: string;
}

interface GroupRow {
  id: string;
  round_id: string;
  title: string;
  region: string;
  held_on: string;
  present: number;
  roles: Record<string, number> | null;
  counts: Record<string, Record<string, number>> | null;
  notes: Record<string, string> | null;
  collected_by: string;
  updated_at: string;
}

const count = z.number().int().min(0).max(500);

/**
 * Nothing here coerces. An empty box stays absent — "we didn't ask that" — and
 * never becomes a zero, which would say "we asked and nobody put a hand up".
 */
export const groupRecordSchema = z
  .object({
    id: z.string().uuid(),
    roundId: z.string().min(1).max(80),
    title: z.string().trim().min(1, 'Give the group a name, such as "Ballarat grower group".').max(160),
    region: z.string().trim().max(120),
    heldOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date it was held.'),
    present: z.number().int().min(1, 'How many people were in the room?').max(500),
    roles: z.record(z.string(), count),
    counts: z.record(z.string(), z.record(z.string(), count)),
    notes: z.record(z.string(), z.string().max(4000)),
    collectedBy: z.string().uuid(),
    updatedAt: z.string(),
  })
  .superRefine((record, context) => {
    // A count can never exceed the room. It is the error most likely to creep
    // in when somebody types a percentage into a box that wants a number.
    for (const [questionId, options] of Object.entries(record.counts)) {
      for (const [optionId, hands] of Object.entries(options)) {
        if (hands > record.present) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['counts', questionId, optionId],
            message: `${hands} is more than the ${record.present} people present.`,
          });
        }
      }
    }
  });

const toRow = (record: GroupRecord): GroupRow => ({
  id: record.id,
  round_id: record.roundId,
  title: record.title,
  region: record.region,
  held_on: record.heldOn,
  present: record.present,
  roles: { ...record.roles },
  counts: Object.fromEntries(Object.entries(record.counts).map(([k, v]) => [k, { ...v }])),
  notes: { ...record.notes },
  collected_by: record.collectedBy,
  updated_at: new Date().toISOString(),
});

const fromRow = (row: GroupRow): GroupRecord => ({
  id: row.id,
  roundId: row.round_id,
  title: row.title,
  region: row.region ?? '',
  heldOn: row.held_on,
  present: row.present,
  roles: row.roles ?? {},
  counts: row.counts ?? {},
  notes: row.notes ?? {},
  collectedBy: row.collected_by,
  updatedAt: row.updated_at,
});

/** Demo mode keeps group records on the device, so the screens can be tried. */
const demoRecords = (): GroupRecord[] => readJson<GroupRecord[]>(STORAGE_KEYS.demoGroups) ?? [];

export const loadGroups = async (): Promise<readonly GroupRecord[]> => {
  const supabase = getSupabase();
  if (supabase === null) return demoRecords();
  const { data, error } = await supabase.from(GROUPS_TABLE).select('*').order('held_on', { ascending: false });
  if (error !== null || data === null) return [];
  return (data as GroupRow[]).map(fromRow);
};

export const saveGroup = async (record: GroupRecord): Promise<Result<GroupRecord>> => {
  const parsed = groupRecordSchema.safeParse(record);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Check the record.' };
  const supabase = getSupabase();
  if (supabase === null) {
    writeJson(STORAGE_KEYS.demoGroups, [record, ...demoRecords().filter((existing) => existing.id !== record.id)]);
    return { success: true, data: record };
  }
  const { error } = await supabase.from(GROUPS_TABLE).upsert(toRow(record), { onConflict: 'id' });
  return error === null ? { success: true, data: record } : { success: false, error: error.message };
};

export const deleteGroup = async (id: string): Promise<Result<true>> => {
  const supabase = getSupabase();
  if (supabase === null) {
    writeJson(STORAGE_KEYS.demoGroups, demoRecords().filter((record) => record.id !== id));
    return { success: true, data: true };
  }
  const { error } = await supabase.from(GROUPS_TABLE).delete().eq('id', id);
  return error === null ? { success: true, data: true } : { success: false, error: error.message };
};

/** Questions that make sense to put to a room. Role branches are left out: a room is mixed. */
export const groupQuestions = (questionnaire: Questionnaire): readonly Question[] =>
  [...questionnaire.core, ...questionnaire.projectDesign].flatMap((section) => section.questions);

/** What a hand means for each kind of question, said the same way everywhere. */
export const handsMeaning = (question: Question): string => {
  switch (question.kind) {
    case 'rating':
      return 'Hands up for each area that is a high priority (4 or 5).';
    case 'rank':
      return 'Hands up for each one that is in their top three.';
    case 'single':
      return 'Hands up for the one answer that fits them best.';
    case 'multi':
      return 'Hands up for every one that applies to them.';
    case 'text':
      return 'Note what the room said, in its own words.';
  }
};

export const optionsForGroup = (question: Question) => {
  if (question.kind === 'multi' || question.kind === 'single') return question.options;
  if (question.kind === 'rating') return question.rows;
  if (question.kind === 'rank') return question.fallbackOptions;
  return [];
};

export interface GroupSummaryRow {
  readonly id: string;
  readonly label: string;
  readonly hands: number;
  /** People present in the groups that were asked this question. */
  readonly asked: number;
  readonly share: number;
}

/**
 * Totals across every group that was asked a question. The denominator is the
 * people present in groups that were asked it — never every group — so a
 * question raised at one meeting is not diluted by five that never heard it.
 */
export const summariseGroups = (
  questionnaire: Questionnaire,
  records: readonly GroupRecord[],
  questionId: string,
): { readonly groups: number; readonly people: number; readonly rows: readonly GroupSummaryRow[] } => {
  const question = questionById(questionnaire, questionId);
  const askedIn = records.filter((record) => record.counts[questionId] !== undefined);
  const people = askedIn.reduce((sum, record) => sum + record.present, 0);
  const rows = (question === undefined ? [] : optionsForGroup(question)).map((option) => {
    const hands = askedIn.reduce((sum, record) => sum + (record.counts[questionId]?.[option.id] ?? 0), 0);
    return {
      id: option.id,
      label: option.label,
      hands,
      asked: people,
      share: people === 0 ? 0 : Number((hands / people).toFixed(2)),
    };
  });
  return { groups: askedIn.length, people, rows: [...rows].sort((a, b) => b.hands - a.hands) };
};

/** Long format: one row per group, question and option — ready for a pivot table. */
export const groupsCsv = (questionnaire: Questionnaire, records: readonly GroupRecord[]): string => {
  const headers = ['group', 'held_on', 'region', 'round', 'present', 'question_id', 'question', 'option', 'hands', 'note'];
  const rows: Record<string, string | number>[] = [];
  for (const record of records) {
    for (const question of allQuestions(questionnaire)) {
      const counts = record.counts[question.id];
      const note = record.notes[question.id] ?? '';
      if (counts === undefined && note.length === 0) continue;
      const base = {
        group: record.title,
        held_on: record.heldOn,
        region: record.region,
        round: record.roundId,
        present: record.present,
        question_id: question.id,
        question: question.prompt,
      };
      if (counts === undefined || Object.keys(counts).length === 0) {
        rows.push({ ...base, option: '', hands: '', note });
        continue;
      }
      Object.entries(counts).forEach(([optionId, hands], index) => {
        rows.push({ ...base, option: optionLabel(question, optionId), hands, note: index === 0 ? note : '' });
      });
    }
  }
  return toCsv(headers, rows);
};
