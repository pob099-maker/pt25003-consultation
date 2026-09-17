/**
 * Thin, total wrapper over localStorage. Every access is guarded: a private
 * window, blocked site data or a sandboxed frame makes the accessor itself
 * throw, and losing the ability to resume must never break the consultation.
 */
export const readJson = <T>(key: string): T | null => {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const writeJson = (key: string, value: unknown): void => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Progress will not be resumable. Nothing else is affected. */
  }
};

export const removeKey = (key: string): void => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

export const STORAGE_KEYS = {
  draft: 'pt25003.draft.v1',
  outbox: 'pt25003.outbox.v1',
  tags: 'pt25003.tags.v1',
  theme: 'pt25003.theme.v1',
  progressOptOut: 'pt25003.progress-optout.v1',
  interviewDraft: 'pt25003.interview-draft.v1',
  interviewSetup: 'pt25003.interview-setup.v1',
  demoGroups: 'pt25003.demo-groups.v1',
  demoWorkshops: 'pt25003.demo-workshops.v1',
  workshopParticipant: 'pt25003.workshop',
} as const;
