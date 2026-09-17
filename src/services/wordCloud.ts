/**
 * Word cloud layout: the biggest word in the middle, every other word walked
 * outward along a spiral until it finds a spot that overlaps nothing.
 *
 * Pure, and deterministic for the same input, so the cloud does not reshuffle
 * every time the screen polls for results.
 */

export interface CloudInput {
  readonly word: string;
  /** Font size in layout units. */
  readonly size: number;
}

export interface PlacedWord {
  readonly word: string;
  readonly size: number;
  /** Centre of the word. */
  readonly x: number;
  readonly y: number;
  readonly rotated: boolean;
  /** Bounding box as drawn: left, top, width, height. */
  readonly box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

export interface CloudLayout {
  readonly words: readonly PlacedWord[];
  /** Tight box around everything placed, for the SVG viewBox. */
  readonly bounds: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

type Measure = (word: string, size: number) => number;

const overlaps = (a: PlacedWord['box'], b: PlacedWord['box'], pad: number): boolean =>
  a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/**
 * Every fourth word after the first few is turned on its side, and never a
 * long phrase: a sideways "wet harvest" is hard to read from the back.
 */
const shouldRotate = (index: number, word: string): boolean =>
  index >= 3 && index % 4 === 3 && word.length <= 12 && !word.includes(' ');

export const layoutCloud = (input: readonly CloudInput[], measure: Measure, aspect = 16 / 9): CloudLayout => {
  const placed: PlacedWord[] = [];
  input.forEach((item, index) => {
    const rotated = shouldRotate(index, item.word);
    const textW = measure(item.word, item.size);
    const textH = item.size * 1.05;
    const w = rotated ? textH : textW;
    const h = rotated ? textW : textH;
    const pad = item.size * 0.12;
    // Walk an Archimedean spiral, stretched to the screen's shape.
    const step = Math.max(2, item.size * 0.08);
    for (let t = 0; t < 4000; t += 1) {
      const angle = t * 0.35;
      const radius = step * angle * 0.5;
      const cx = Math.cos(angle) * radius * aspect;
      const cy = Math.sin(angle) * radius;
      const box = { x: cx - w / 2, y: cy - h / 2, w, h };
      if (!placed.some((other) => overlaps(box, other.box, pad))) {
        placed.push({ word: item.word, size: item.size, x: cx, y: cy, rotated, box });
        return;
      }
    }
    // Gave up: the word is left out rather than drawn over another.
  });

  if (placed.length === 0) return { words: [], bounds: { x: 0, y: 0, w: 1, h: 1 } };
  const left = Math.min(...placed.map((p) => p.box.x));
  const top = Math.min(...placed.map((p) => p.box.y));
  const right = Math.max(...placed.map((p) => p.box.x + p.box.w));
  const bottom = Math.max(...placed.map((p) => p.box.y + p.box.h));
  return { words: placed, bounds: { x: left, y: top, w: right - left, h: bottom - top } };
};

/** A rough width when no canvas is available (tests, very old browsers). */
export const estimateWidth: Measure = (word, size) => word.length * size * 0.56;
