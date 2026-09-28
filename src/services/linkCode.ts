/**
 * An anonymous code that lets one person's answers be followed from one round
 * to the next without anybody knowing who they are.
 *
 * It is built from three facts that never change and that everybody knows
 * without looking anything up: the first two letters of their mother's first
 * name, the day of the month they were born, and the first two letters of the
 * town they grew up in. The same person gets the same code every time, so
 * there is nothing to remember and nothing to write down.
 *
 * Foolproof by construction rather than by instruction. People are never asked
 * to type the code itself, because they would type it differently each time:
 * JO14BA, jo14ba, JO 14 BA, 14JOBA, J014BA with a zero. The form asks for the
 * three pieces separately, cleans each one, and puts them together in one
 * fixed order. "Home town" was avoided on purpose: it changes when somebody
 * moves, and the code with it.
 */

export const LINK_CODE_ID = 'link_code';

export interface LinkCodeParts {
  readonly mother: string;
  readonly day: string;
  readonly town: string;
}

export const EMPTY_PARTS: LinkCodeParts = { mother: '', day: '', town: '' };

const PATTERN = /^[A-Z]{2}(0[1-9]|[12][0-9]|3[01])[A-Z]{2}$/;

/**
 * Two capital letters from whatever was typed. Accents are folded (Zoë and Zoe
 * give the same letters), and spaces, digits and punctuation are dropped, so
 * "o'brien" and "O Brien" both give OB.
 */
export const twoLetters = (typed: string): string =>
  typed
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2);

/** A day of the month as two digits, or '' for anything that is not one. */
export const twoDigitDay = (typed: string): string => {
  const day = Number.parseInt(typed.replace(/[^0-9]/g, ''), 10);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? String(day).padStart(2, '0') : '';
};

/** The finished code, or null until all three pieces are there. */
export const buildLinkCode = (parts: LinkCodeParts): string | null => {
  const mother = twoLetters(parts.mother);
  const day = twoDigitDay(parts.day);
  const town = twoLetters(parts.town);
  if (mother.length !== 2 || day === '' || town.length !== 2) return null;
  return `${mother}${day}${town}`;
};

export const isLinkCode = (value: string): boolean => PATTERN.test(value);

/** The three pieces of a stored code, to show it again if somebody comes back to the page. */
export const partsOf = (code: string): LinkCodeParts =>
  isLinkCode(code) ? { mother: code.slice(0, 2), day: String(Number(code.slice(2, 4))), town: code.slice(4, 6) } : EMPTY_PARTS;

/** Something typed in at least one box: the person has started, and should finish or clear it. */
export const isStarted = (parts: LinkCodeParts): boolean =>
  parts.mother.trim() !== '' || parts.day.trim() !== '' || parts.town.trim() !== '';
