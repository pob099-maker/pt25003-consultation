import { useEffect, useState } from 'react';
import { STORAGE_KEYS, readJson, removeKey, writeJson } from '../lib/storage';

type Choice = 'light' | 'dark' | 'system';

const apply = (choice: Choice): void => {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
};

/**
 * Reads the stored choice before first paint where it can, so a reader who
 * chose dark does not get a flash of cream first.
 */
export const applyStoredTheme = (): void => {
  const stored = readJson<Choice>(STORAGE_KEYS.theme);
  if (stored === 'light' || stored === 'dark') apply(stored);
};

/* Drawn rather than typed. An emoji renders from the operating system's own
 * colour font, so it ignores the palette, sits at a size the type scale does
 * not control, and looks like three different buttons across a phone, a Mac and
 * a Windows laptop. A path that inherits currentColor does not. */
const Icon = ({ dark }: { dark: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
    {dark ? (
      <>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
      </>
    ) : (
      <path d="M20 14.5A8.2 8.2 0 0 1 9.5 4 8.3 8.3 0 1 0 20 14.5Z" strokeLinejoin="round" />
    )}
  </svg>
);

/**
 * Follows the phone unless the reader says otherwise, and then remembers.
 *
 * Kept to two states in the control — light and dark — because a three-way
 * light/dark/system picker is a preference dialogue, and this is a page
 * somebody was asked to spend ten minutes on. Clearing the stored choice is
 * possible by switching back to whatever the phone is set to, which is what
 * somebody who wants "follow my phone" would do anyway.
 */
export const ThemeToggle = () => {
  const [dark, setDark] = useState<boolean>(() => {
    const stored = readJson<Choice>(STORAGE_KEYS.theme);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark === systemDark) {
      removeKey(STORAGE_KEYS.theme);
      apply('system');
      return;
    }
    const choice: Choice = dark ? 'dark' : 'light';
    writeJson(STORAGE_KEYS.theme, choice);
    apply(choice);
  }, [dark]);

  return (
    <button
      type="button"
      onClick={() => setDark((current) => !current)}
      aria-pressed={dark}
      className="rounded-md border border-line p-2 text-ink-soft hover:bg-sunk"
      title={dark ? 'Switch to light' : 'Switch to dark'}
    >
      <Icon dark={dark} />
      <span className="sr-only">{dark ? 'Switch to the light theme' : 'Switch to the dark theme'}</span>
    </button>
  );
};
