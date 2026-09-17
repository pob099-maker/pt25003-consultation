import { describe, expect, it } from 'vitest';
import { estimateWidth, layoutCloud } from './wordCloud';

const words = [
  'labour',
  'wet harvest',
  'breakdowns',
  'rain',
  'bruising',
  'late harvest',
  'staff',
  'mud',
  'storage',
].map((word, index) => ({ word, size: 80 - index * 7 }));

describe('layoutCloud', () => {
  const layout = layoutCloud(words, estimateWidth);

  it('places every word', () => {
    expect(layout.words.map((placed) => placed.word)).toEqual(words.map((item) => item.word));
  });

  it('puts the biggest word in the middle', () => {
    expect(layout.words[0]).toMatchObject({ word: 'labour', x: 0, y: 0 });
  });

  it('never draws one word over another', () => {
    for (const [i, a] of layout.words.entries()) {
      for (const b of layout.words.slice(i + 1)) {
        const apart =
          a.box.x + a.box.w <= b.box.x ||
          b.box.x + b.box.w <= a.box.x ||
          a.box.y + a.box.h <= b.box.y ||
          b.box.y + b.box.h <= a.box.y;
        expect(apart, `${a.word} overlaps ${b.word}`).toBe(true);
      }
    }
  });

  it('turns some short words on their side, but never a phrase', () => {
    expect(layout.words.some((placed) => placed.rotated)).toBe(true);
    expect(layout.words.filter((placed) => placed.rotated).every((placed) => !placed.word.includes(' '))).toBe(true);
  });

  it('gives the same picture for the same words', () => {
    expect(layoutCloud(words, estimateWidth)).toEqual(layout);
  });

  it('spreads wider than it is tall, like a screen', () => {
    expect(layout.bounds.w).toBeGreaterThan(layout.bounds.h);
  });
});
