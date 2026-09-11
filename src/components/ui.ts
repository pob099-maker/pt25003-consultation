/** Shared class strings, so a button looks the same everywhere it appears. */

export const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-body font-semibold min-h-12 transition-colors';

export const primaryButton = `${buttonBase} bg-accent text-white hover:bg-accent-strong`;

export const secondaryButton = `${buttonBase} border border-line-strong bg-surface text-ink hover:bg-sunk`;

export const quietButton = 'text-accent underline underline-offset-4 hover:text-accent-strong';

export const card = 'rounded-lg border border-line bg-surface p-5 sm:p-6';

/** Tap targets stay comfortably above the 44px guidance on a phone. */
export const choiceRow =
  'flex w-full items-start gap-3 rounded-md border border-line bg-surface p-4 text-left min-h-14 hover:border-line-strong';

export const choiceRowSelected = 'border-accent bg-accent-soft';

export const textInput =
  'w-full rounded-md border border-line-strong bg-surface px-3 py-3 text-body text-ink placeholder:text-ink-faint min-h-12';
