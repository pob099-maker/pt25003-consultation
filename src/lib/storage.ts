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

/**
 * The demo is served from the same address as the live tool, so the browser
 * treats them as one site and they would share this storage. Its own prefix
 * keeps a demo answer from ever sitting in the live outbox, waiting to be sent.
 */
const BASE = import.meta.env.VITE_DEMO === 'true' ? 'pt25003-demo' : 'pt25003';

/**
 * A draft belongs to the project it was started in. The deployment's own
 * project keeps the original key names, so a response already queued on
 * somebody's phone is still found and sent.
 */
const chosen = ((): string => {
  try {
    return window.localStorage.getItem('pt25003.project.v1') ?? '';
  } catch {
    return '';
  }
})();
const deploymentProject = (import.meta.env.VITE_PROJECT_ID ?? 'PT25003').trim();
const PREFIX = chosen === '' || chosen === deploymentProject ? BASE : `${BASE}.${chosen.toLowerCase()}`;

export const STORAGE_KEYS = {
  draft: `${PREFIX}.draft.v1`,
  outbox: `${PREFIX}.outbox.v1`,
  tags: `${PREFIX}.tags.v1`,
  theme: `${PREFIX}.theme.v1`,
  progressOptOut: `${PREFIX}.progress-optout.v1`,
  interviewDraft: `${PREFIX}.interview-draft.v1`,
  interviewSetup: `${PREFIX}.interview-setup.v1`,
  demoGroups: `${PREFIX}.demo-groups.v1`,
  demoWorkshops: `${PREFIX}.demo-workshops.v1`,
  workshopParticipant: `${PREFIX}.workshop`,
} as const;
