import { describe, expect, it } from 'vitest';
import { EMPTY_PARTS, buildLinkCode, isLinkCode, isStarted, partsOf, twoDigitDay, twoLetters } from './linkCode';

describe('buildLinkCode', () => {
  it('builds the same code however the same person types it', () => {
    const codes = [
      buildLinkCode({ mother: 'Jo', day: '14', town: 'Ballarat' }),
      buildLinkCode({ mother: 'jo', day: '14', town: 'ba' }),
      buildLinkCode({ mother: ' JO ', day: '14th', town: 'B A' }),
      buildLinkCode({ mother: 'Joan', day: '014', town: 'ballarat' }),
    ];
    expect(new Set(codes)).toEqual(new Set(['JO14BA']));
  });

  it('pads a single-digit day, so the 5th is always 05', () => {
    expect(buildLinkCode({ mother: 'Mary', day: '5', town: 'Scottsdale' })).toBe('MA05SC');
    expect(buildLinkCode({ mother: 'Mary', day: '05', town: 'Scottsdale' })).toBe('MA05SC');
  });

  it('folds accents and drops punctuation, so a name is not two codes', () => {
    expect(twoLetters('Zoë')).toBe('ZO');
    expect(twoLetters("o'brien")).toBe('OB');
    expect(twoLetters('Élise')).toBe('EL');
  });

  it('refuses anything short of three complete pieces', () => {
    expect(buildLinkCode(EMPTY_PARTS)).toBeNull();
    expect(buildLinkCode({ mother: 'J', day: '14', town: 'Ballarat' })).toBeNull();
    expect(buildLinkCode({ mother: 'Jo', day: '32', town: 'Ballarat' })).toBeNull();
    expect(buildLinkCode({ mother: 'Jo', day: '0', town: 'Ballarat' })).toBeNull();
    expect(buildLinkCode({ mother: '12', day: '14', town: 'Ballarat' })).toBeNull();
  });
});

describe('the pieces', () => {
  it('reads a day of the month and nothing else', () => {
    expect(twoDigitDay('31')).toBe('31');
    expect(twoDigitDay('')).toBe('');
    expect(twoDigitDay('abc')).toBe('');
  });

  it('shows a stored code again as its three pieces', () => {
    expect(partsOf('MA05SC')).toEqual({ mother: 'MA', day: '5', town: 'SC' });
    expect(partsOf('not a code')).toEqual(EMPTY_PARTS);
  });

  it('knows when somebody has started but not finished', () => {
    expect(isStarted(EMPTY_PARTS)).toBe(false);
    expect(isStarted({ mother: 'Jo', day: '', town: '' })).toBe(true);
  });

  it('only ever accepts the one shape', () => {
    expect(isLinkCode('JO14BA')).toBe(true);
    expect(isLinkCode('jo14ba')).toBe(false);
    expect(isLinkCode('JO4BA')).toBe(false);
    expect(isLinkCode('JO 14 BA')).toBe(false);
    expect(isLinkCode('JO00BA')).toBe(false);
  });
});

describe('letters that do not break into a letter and an accent', () => {
  it('are folded to what somebody typing without them would write', () => {
    expect(twoLetters('Łucja')).toBe('LU');
    expect(twoLetters('Øydis')).toBe('OY');
    expect(twoLetters('Æsa')).toBe('AE');
    expect(twoLetters('Þóra')).toBe('TH');
    expect(twoLetters('Ｊｏ')).toBe('JO');
  });
});
