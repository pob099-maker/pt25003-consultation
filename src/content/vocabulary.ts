import type { RoundStage } from '../types';

/**
 * One name per idea, used everywhere a person reads it. See docs/CONCEPTS.md.
 *
 * The words in the database do not change — a round is still a round in
 * `consultation_rounds`, and a repeated question still carries `tracking` — so
 * nothing already collected shifts. This is what those things are called on
 * screen, where four names for one idea was making the tool hard to follow.
 */

/** What a project calls one period of asking. A project setting, one day. */
export const COLLECTION = {
  one: 'consultation',
  One: 'Consultation',
  many: 'consultations',
  Many: 'Consultations',
} as const;

/** What a consultation is structurally, as opposed to what the project named it. */
export const ROLE_LABEL: Readonly<Record<RoundStage, string>> = {
  pilot: 'Practice',
  baseline: 'Starting point',
  review: 'Follow-up',
};

export const ROLE_HELP: Readonly<Record<RoundStage, string>> = {
  pilot: 'For trying the questions out. Never counted in any comparison.',
  baseline: 'The one everything else is measured against. There is only one.',
  review: 'Compared back to the starting point. Also asks what people have seen from the project.',
};

/** The handful of questions asked word for word every time. */
export const REPEAT = {
  one: 'repeat question',
  many: 'repeat questions',
  Many: 'Repeat questions',
  /** Said of a single question in a list. */
  tag: 'Repeats every time',
} as const;

/**
 * A plain sentence naming where a project is up to, for the top of the admin
 * area: "PT25003 measures change. Baseline is collecting now."
 */
export const planSentence = (
  projectName: string,
  measuresChange: boolean,
  current: { readonly label: string; readonly stage: RoundStage } | null,
): string => {
  const what = measuresChange
    ? `${projectName} measures change over time.`
    : `${projectName} runs a single ${COLLECTION.one}.`;
  if (current === null) return `${what} Nothing is collecting yet.`;
  return `${what} ${current.label} (${ROLE_LABEL[current.stage].toLowerCase()}) is collecting now.`;
};
