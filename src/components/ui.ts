/** Shared class strings, so a button looks the same everywhere it appears. */

export const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-body font-semibold min-h-12 transition-colors';

/** Brown, white text, on either theme. */
export const primaryButton = `${buttonBase} bg-primary text-white hover:bg-primary/90`;

export const secondaryButton = `${buttonBase} border border-line-strong bg-surface text-ink hover:bg-sunk`;

export const quietButton = 'text-primary-ink underline underline-offset-4 hover:opacity-80';

export const card = 'rounded-xl border border-line bg-surface p-5 sm:p-6';

/** A panel that should read as the project speaking, rather than as content. */
export const accentPanel = 'rounded-xl border border-accent/60 bg-sunk p-5 sm:p-6';

/** Tap targets stay comfortably above the 44px guidance on a phone. */
export const choiceRow =
  'flex w-full items-start gap-3 rounded-lg border border-line bg-surface p-4 text-left min-h-14 hover:border-line-strong';

export const choiceRowSelected = 'border-primary bg-selected';

export const textInput =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-3 text-body text-ink placeholder:text-ink-faint min-h-12';
