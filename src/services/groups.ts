import { z } from 'zod';
import { getSupabase } from '../lib/supabase';
import { STORAGE_KEYS, readJson, writeJson } from '../lib/storage';
import { allQuestions, isPersonalQuestion, optionLabel, questionById } from '../content/lookup';
import { toCsv } from '../lib/csv';
import { currentProject } from '../content/projects';
import type { Question, Questionnaire, Result } from '../types';

export const GROUPS_TABLE = 'consultation_group_records';

/**
 * How a group was asked. A poll in a regional chat group is recorded exactly
 * as a room is: the people who answered it are its "present", and the votes
 * for each choice are its hands. It stays a group, never a set of responses.
 */
export type GroupFormat = 'room' | 'video' | 'chat_poll';

export const GROUP_FORMATS: readonly {
  readonly id: GroupFormat;
  readonly label: string;
  /** What the number of people means for this kind of group. */
  readonly present: string;
}[] = [
  { id: 'room', label: 'In a room', present: 'People in the room' },
  { id: 'video', label: 'On a video call', present: 'People on the call' },
  { id: 'chat_poll', label: 'As a poll in a chat group', present: 'People who answered the poll' },
];

export const formatOf = (record: Pick<GroupRecord, 'heldAs'>): GroupFormat => record.heldAs ?? 'room';

/**
 * The most choices one WhatsApp poll takes at the time of writing. Check it in
 * the app before relying on it: a question with more choices than this cannot
 * be put as one poll without leaving some out.
 */
export const POLL_CHOICES = 12;

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
  /** Absent on a record made before polls were recorded: that was a room. */
  readonly heldAs?: GroupFormat;
}

interface GroupRow {
  id: string;
  project_id?: string;
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
  /** Missing from a database a migration behind. */
  held_as?: string;
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
    heldAs: z.enum(['room', 'video', 'chat_poll']).optional(),
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
  project_id: currentProject().id,
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
  held_as: formatOf(record),
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
  heldAs: row.held_as === 'video' || row.held_as === 'chat_poll' ? row.held_as : 'room',
});

/** Demo mode keeps group records on the device, so the screens can be tried. */
const demoRecords = (): GroupRecord[] => readJson<GroupRecord[]>(STORAGE_KEYS.demoGroups) ?? [];

export const loadGroups = async (): Promise<readonly GroupRecord[]> => {
  const supabase = getSupabase();
  if (supabase === null) return demoRecords();
  const { data, error } = await supabase.from(GROUPS_TABLE).select('*').eq('project_id', currentProject().id).order('held_on', { ascending: false });
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
  const row = toRow(record);
  const { error } = await supabase.from(GROUPS_TABLE).upsert(row, { onConflict: 'id' });
  if (error === null) return { success: true, data: record };
  // A database a migration behind has no column for how a group was held. Every
  // record it holds is a room, so a room still saves without it; anything else
  // would quietly become a room, so it is refused until the update is run.
  if (error.code === 'PGRST204' && /'held_as'/.test(error.message)) {
    if (row.held_as !== 'room') {
      return {
        success: false,
        error: 'Recording a video call or a chat poll needs a database update first (migration 0018). Nothing was saved.',
      };
    }
    const withoutFormat = Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'held_as'));
    const retry = await supabase.from(GROUPS_TABLE).upsert(withoutFormat, { onConflict: 'id' });
    return retry.error === null ? { success: true, data: record } : { success: false, error: retry.error.message };
  }
  return { success: false, error: error.message };
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

/**
 * Questions that make sense to put to a room. Role branches are left out: a
 * room is mixed. So are the questions one person answers about themselves: a
 * room has no follow-up code and gives no permission to quote, and a code
 * typed into a word cloud would be refused along with every other answer that
 * phone gave, and shown on the big screen besides.
 */
export const groupQuestions = (questionnaire: Questionnaire): readonly Question[] =>
  [...questionnaire.core, ...questionnaire.projectDesign]
    .flatMap((section) => section.questions)
    .filter((question) => !isPersonalQuestion(question));

/** What a hand means for each kind of question, said the same way everywhere. */
export const handsMeaning = (question: Question, format: GroupFormat = 'room'): string => {
  if (format === 'chat_poll') {
    switch (question.kind) {
      case 'multi':
        return 'Votes for each choice. Set the poll to allow more than one answer.';
      case 'single':
        return 'Votes for each choice. Set the poll to allow one answer only.';
      case 'text':
        return 'Note what the group said, in its own words.';
      default:
        return 'A poll cannot ask this one word for word. Leave it empty unless the group answered it another way.';
    }
  }
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

/**
 * The poll to paste into a chat group: the question and its choices, word for
 * word, so the votes count as answers to the same question. Only a tick list
 * or a single choice can be put as a poll; anything else gets null.
 */
export const pollText = (question: Question): string | null => {
  if (question.kind !== 'multi' && question.kind !== 'single') return null;
  return [question.prompt, ...question.options.map((option) => option.label)].join('\n');
};

/** Why a question cannot go out as one poll as it stands, if it cannot. */
export const pollProblem = (question: Question): string | null => {
  if (question.kind !== 'multi' && question.kind !== 'single') return null;
  return question.options.length > POLL_CHOICES
    ? `It has ${question.options.length} choices, and a WhatsApp poll takes ${POLL_CHOICES}. Leaving some out would change the question, so ask this one another way.`
    : null;
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
  const headers = ['group', 'held_as', 'held_on', 'region', 'round', 'present', 'question_id', 'question', 'option', 'hands', 'note'];
  const rows: Record<string, string | number>[] = [];
  for (const record of records) {
    for (const question of allQuestions(questionnaire)) {
      const counts = record.counts[question.id];
      const note = record.notes[question.id] ?? '';
      if (counts === undefined && note.length === 0) continue;
      const base = {
        group: record.title,
        held_as: formatOf(record),
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
