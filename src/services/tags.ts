import { STORAGE_KEYS, readJson, writeJson } from '../lib/storage';
import { getSupabase } from '../lib/supabase';

export const THEME_TAGS = [
  'Labour',
  'Timeliness',
  'Harvesting',
  'Planting',
  'Logistics',
  'Grading',
  'Packhouse',
  'Quality',
  'Damage',
  'Reliability',
  'Safety',
  'Irrigation',
  'Data',
  'Training',
  'ROI',
  'Service support',
] as const;

export const TAGS_TABLE = 'consultation_text_tags';

/** Keyed by `${responseId}:${questionId}`. */
export type TagMap = Readonly<Record<string, readonly string[]>>;

export const tagKey = (responseId: string, questionId: string): string => `${responseId}:${questionId}`;

export const loadTags = async (): Promise<TagMap> => {
  const supabase = getSupabase();
  if (supabase === null) return readJson<TagMap>(STORAGE_KEYS.tags) ?? {};
  const { data, error } = await supabase.from(TAGS_TABLE).select('response_id, question_id, tags');
  if (error !== null || data === null) return readJson<TagMap>(STORAGE_KEYS.tags) ?? {};
  const map: Record<string, readonly string[]> = {};
  for (const row of data as { response_id: string; question_id: string; tags: string[] }[]) {
    map[tagKey(row.response_id, row.question_id)] = row.tags ?? [];
  }
  return map;
};

export const saveTags = async (
  responseId: string,
  questionId: string,
  tags: readonly string[],
  current: TagMap,
): Promise<TagMap> => {
  const next: Record<string, readonly string[]> = { ...current, [tagKey(responseId, questionId)]: tags };
  writeJson(STORAGE_KEYS.tags, next);
  const supabase = getSupabase();
  if (supabase !== null) {
    await supabase
      .from(TAGS_TABLE)
      .upsert({ response_id: responseId, question_id: questionId, tags: [...tags] }, { onConflict: 'response_id,question_id' });
  }
  return next;
};
