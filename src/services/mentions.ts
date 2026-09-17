/**
 * How an interviewer marks an item in a "listen for" list.
 *
 * Every marked item is *mentioned* — that is what pools with the online form.
 * Within that, an item is either raised unprompted, or only after the list was
 * read. Clicking the state an item is already in clears it, so a mistaken tap
 * is one more tap to undo.
 */

export type MentionState = 'none' | 'unprompted' | 'prompted';

export interface Mentions {
  readonly values: readonly string[];
  readonly prompted: readonly string[];
}

export const mentionState = (mentions: Mentions, id: string): MentionState => {
  if (!mentions.values.includes(id)) return 'none';
  return mentions.prompted.includes(id) ? 'prompted' : 'unprompted';
};

export const markMention = (mentions: Mentions, id: string, how: Exclude<MentionState, 'none'>): Mentions => {
  const current = mentionState(mentions, id);
  if (current === how) {
    return {
      values: mentions.values.filter((value) => value !== id),
      prompted: mentions.prompted.filter((value) => value !== id),
    };
  }
  const values = mentions.values.includes(id) ? mentions.values : [...mentions.values, id];
  const withoutId = mentions.prompted.filter((value) => value !== id);
  return { values, prompted: how === 'prompted' ? [...withoutId, id] : withoutId };
};
