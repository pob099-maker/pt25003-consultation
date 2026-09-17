/**
 * Charts as standalone SVG, for downloading as a picture to paste into a
 * report or a slide. Drawn from the numbers, not copied off the screen, so a
 * picture looks the same whether it was saved from a phone or a projector,
 * in the light theme or the dark one.
 *
 * Everything that comes from a respondent — a typed word in particular — is
 * escaped before it goes into the markup.
 */

export interface Palette {
  readonly paper: string;
  readonly ink: string;
  readonly inkSoft: string;
  readonly faint: string;
  readonly line: string;
  readonly bar: string;
  readonly track: string;
  readonly scale: readonly [string, string, string, string, string];
}

/** Reads the export colours from the stylesheet, so no colour is written twice in code. */
export const exportPalette = (): Palette => {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string): string => style.getPropertyValue(`--export-${name}`).trim() || fallback;
  return {
    paper: get('paper', 'white'),
    ink: get('ink', 'black'),
    inkSoft: get('ink-soft', 'dimgray'),
    faint: get('faint', 'silver'),
    line: get('line', 'gainsboro'),
    bar: get('bar', 'black'),
    track: get('track', 'whitesmoke'),
    scale: [
      get('scale-1', 'gray'),
      get('scale-2', 'gray'),
      get('scale-3', 'gray'),
      get('scale-4', 'gray'),
      get('scale-5', 'gray'),
    ],
  };
};

const FONT = "'Segoe UI', Arial, Helvetica, sans-serif";

export const escapeXml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** Breaks text into lines of roughly `width` characters, never more than `maxLines`. */
export const wrap = (text: string, width: number, maxLines = 2): readonly string[] => {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    if (current.length > 0 && current.length + 1 + word.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = current.length === 0 ? word : `${current} ${word}`;
    }
  }
  if (current.length > 0) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${(kept[maxLines - 1] ?? '').replace(/\s*\S*$/, '')}…`;
  return kept;
};

const textLines = (lines: readonly string[], x: number, y: number, size: number, fill: string, extra = ''): string =>
  lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * size * 1.25}" font-size="${size}" fill="${fill}" ${extra}>${escapeXml(line)}</text>`,
    )
    .join('');

export interface ChartHeading {
  readonly title: string;
  /** Who answered and where it came from, e.g. "14 people · Ballarat field day · 17 Sep 2026". */
  readonly note: string;
}

const WIDTH = 1200;
const PAD = 40;

const frame = (heading: ChartHeading, bodyHeight: number, body: (top: number) => string, palette: Palette) => {
  const titleLines = wrap(heading.title, 70, 3);
  const titleHeight = titleLines.length * 34 + 8;
  const top = PAD + titleHeight + 30;
  const height = top + bodyHeight + PAD;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" font-family="${FONT}">` +
    `<rect width="${WIDTH}" height="${height}" fill="${palette.paper}"/>` +
    textLines(titleLines, PAD, PAD + 22, 27, palette.ink, 'font-weight="700"') +
    textLines([heading.note], PAD, PAD + titleHeight + 6, 17, palette.inkSoft) +
    body(top) +
    '</svg>';
  return { svg, width: WIDTH, height };
};

export interface ChartImage {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
}

// --- Bars -------------------------------------------------------------------

export interface BarRow {
  readonly label: string;
  /** 0 to 1: the length of the bar. */
  readonly value: number;
  /** What is printed at the end, e.g. "9 · 64%". */
  readonly text: string;
}

export const barChartSvg = (heading: ChartHeading, rows: readonly BarRow[], palette: Palette): ChartImage => {
  const rowHeight = 56;
  const labelWidth = 420;
  const barX = PAD + labelWidth;
  const barW = WIDTH - barX - PAD - 150;
  return frame(
    heading,
    rows.length * rowHeight,
    (top) =>
      rows
        .map((row, index) => {
          const y = top + index * rowHeight;
          const lines = wrap(row.label, 38);
          const labelY = y + 22 - (lines.length - 1) * 10;
          const w = Math.max(0, Math.min(1, row.value)) * barW;
          return (
            textLines(lines, PAD, labelY, 19, palette.ink) +
            `<rect x="${barX}" y="${y + 6}" width="${barW}" height="26" rx="13" fill="${palette.track}"/>` +
            `<rect x="${barX}" y="${y + 6}" width="${w}" height="26" rx="13" fill="${palette.bar}"/>` +
            `<text x="${barX + barW + 16}" y="${y + 26}" font-size="19" font-weight="700" fill="${palette.ink}">${escapeXml(row.text)}</text>`
          );
        })
        .join(''),
    palette,
  );
};

// --- Diverging 1-to-5 ------------------------------------------------------------

export interface Segment {
  readonly key: string;
  /** 1 to 5. */
  readonly score: number;
  /** Fractions of the full width; the middle of the chart is 0.5. */
  readonly start: number;
  readonly width: number;
}

/**
 * Where each score's block sits. Half the width stands for everybody who
 * rated the row, so a row everyone rated 5 fills the right half exactly.
 */
export const divergingSegments = (scores: readonly number[]): readonly Segment[] => {
  const total = scores.reduce((sum, count) => sum + count, 0);
  if (total === 0) return [];
  const half = (score: number): number => ((scores[score - 1] ?? 0) / total) * 0.5;
  const segments: Segment[] = [];
  const middle = half(3);
  if (middle > 0) segments.push({ key: 'm', score: 3, start: 0.5 - middle / 2, width: middle });
  let left = 0.5 - middle / 2;
  for (const score of [2, 1]) {
    const width = half(score);
    left -= width;
    if (width > 0) segments.push({ key: `l${score}`, score, start: left, width });
  }
  let right = 0.5 + middle / 2;
  for (const score of [4, 5]) {
    const width = half(score);
    if (width > 0) segments.push({ key: `r${score}`, score, start: right, width });
    right += width;
  }
  return segments;
};

export interface DivergingRow {
  readonly label: string;
  /** How many gave each score, 1 to 5. */
  readonly scores: readonly number[];
  readonly text: string;
}

export const divergingChartSvg = (
  heading: ChartHeading,
  rows: readonly DivergingRow[],
  scaleLabels: readonly [string, string],
  palette: Palette,
): ChartImage => {
  const rowHeight = 52;
  const labelWidth = 400;
  const barX = PAD + labelWidth;
  const barW = WIDTH - barX - PAD - 190;
  const legendHeight = 44;
  return frame(
    heading,
    legendHeight + rows.length * rowHeight,
    (top) => {
      const swatches = palette.scale
        .map(
          (fill, index) =>
            `<rect x="${barX + 150 + index * 30}" y="${top}" width="26" height="18" fill="${fill}"/>` +
            `<text x="${barX + 163 + index * 30}" y="${top + 36}" font-size="13" text-anchor="middle" fill="${palette.inkSoft}">${index + 1}</text>`,
        )
        .join('');
      const legend =
        `<text x="${barX + 140}" y="${top + 14}" font-size="16" text-anchor="end" fill="${palette.inkSoft}">${escapeXml(scaleLabels[0])}</text>` +
        swatches +
        `<text x="${barX + 310}" y="${top + 14}" font-size="16" fill="${palette.inkSoft}">${escapeXml(scaleLabels[1])}</text>`;
      const bodyTop = top + legendHeight;
      const centre = `<line x1="${barX + barW / 2}" y1="${bodyTop}" x2="${barX + barW / 2}" y2="${bodyTop + rows.length * rowHeight}" stroke="${palette.faint}" stroke-width="2"/>`;
      const bars = rows
        .map((row, index) => {
          const y = bodyTop + index * rowHeight;
          const lines = wrap(row.label, 36);
          const labelY = y + 22 - (lines.length - 1) * 10;
          const blocks = divergingSegments(row.scores)
            .map(
              (segment) =>
                `<rect x="${barX + segment.start * barW}" y="${y + 8}" width="${segment.width * barW}" height="24" fill="${palette.scale[segment.score - 1]}"/>`,
            )
            .join('');
          return (
            textLines(lines, PAD, labelY, 18, palette.ink) +
            blocks +
            `<text x="${barX + barW + 16}" y="${y + 26}" font-size="18" font-weight="700" fill="${palette.ink}">${escapeXml(row.text)}</text>`
          );
        })
        .join('');
      return legend + bars + centre;
    },
    palette,
  );
};

// --- Change over time -------------------------------------------------------------

export interface SlopeInput {
  readonly label: string;
  /** One per round; null where nobody answered. */
  readonly values: readonly (number | null)[];
}

export interface SlopeLine {
  readonly label: string;
  readonly points: readonly { readonly x: number; readonly y: number; readonly value: number }[];
  /** Last value minus first, when both exist. */
  readonly change: number | null;
  readonly emphasis: 'up' | 'down' | 'top' | 'none';
  /** Where the end label is drawn, after nudging labels apart. */
  readonly labelY: number | null;
}

export interface SlopeLayout {
  readonly width: number;
  readonly height: number;
  readonly plot: { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number };
  readonly columnX: readonly number[];
  readonly ticks: readonly { readonly y: number; readonly value: number }[];
  readonly lines: readonly SlopeLine[];
}

/**
 * Lines from the baseline to each review. The rows that moved most are
 * coloured and labelled, as are the three highest at the end; everything else
 * is drawn faintly so a fourteen-line chart still says something at a glance.
 */
export const slopeLayout = (
  input: readonly SlopeInput[],
  columns: number,
  measure: 'share' | 'mean',
  size: { readonly width: number; readonly height: number } = { width: 900, height: 420 },
): SlopeLayout => {
  const plot = { left: 30, right: size.width - 330, top: 20, bottom: size.height - 40 };
  const columnX = Array.from({ length: columns }, (_, index) =>
    columns === 1 ? plot.left : plot.left + ((plot.right - plot.left) * index) / (columns - 1),
  );
  const all = input.flatMap((row) => row.values.filter((value): value is number => value !== null));
  const [min, max] =
    measure === 'mean' ? [1, 5] : [0, Math.min(1, Math.max(0.1, Math.ceil((Math.max(0, ...all) + 0.001) * 10) / 10))];
  const yFor = (value: number): number => plot.bottom - ((value - min) / (max - min)) * (plot.bottom - plot.top);
  const step = measure === 'mean' ? 1 : max <= 0.5 ? 0.1 : 0.2;
  const ticks: { y: number; value: number }[] = [];
  for (let value = min; value <= max + 1e-9; value += step)
    ticks.push({ y: yFor(value), value: Number(value.toFixed(2)) });

  const threshold = measure === 'share' ? 0.05 : 0.2;
  const withChange = input.map((row) => {
    const first = row.values.find((value) => value !== null) ?? null;
    const last = [...row.values].reverse().find((value) => value !== null) ?? null;
    return { row, change: first !== null && last !== null ? last - first : null, last };
  });
  const movers = new Set(
    [...withChange]
      .filter((item) => item.change !== null && Math.abs(item.change) >= threshold)
      .sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0))
      .slice(0, 5)
      .map((item) => item.row.label),
  );
  const top = new Set(
    [...withChange]
      .filter((item) => item.last !== null)
      .sort((a, b) => (b.last ?? 0) - (a.last ?? 0))
      .slice(0, 3)
      .map((item) => item.row.label),
  );

  const lines = withChange.map(({ row, change }): Omit<SlopeLine, 'labelY'> & { endY: number | null } => {
    const points = row.values.flatMap((value, index) =>
      value === null ? [] : [{ x: columnX[index] ?? plot.left, y: yFor(value), value }],
    );
    const emphasis = movers.has(row.label) ? ((change ?? 0) > 0 ? 'up' : 'down') : top.has(row.label) ? 'top' : 'none';
    return { label: row.label, points, change, emphasis, endY: points.at(-1)?.y ?? null };
  });

  // Nudge the end labels apart, top to bottom, then back up if they ran off the foot.
  const gap = 22;
  const labelled = lines
    .map((line, index) => ({ index, y: line.emphasis === 'none' ? null : line.endY }))
    .filter((item): item is { index: number; y: number } => item.y !== null)
    .sort((a, b) => a.y - b.y);
  const placed = new Map<number, number>();
  let previous = -Infinity;
  for (const item of labelled) {
    const y = Math.max(item.y, previous + gap);
    placed.set(item.index, y);
    previous = y;
  }
  const overflow = previous - (size.height - 8);
  if (overflow > 0) for (const [index, y] of placed) placed.set(index, y - overflow);

  return {
    width: size.width,
    height: size.height,
    plot,
    columnX,
    ticks,
    lines: lines.map((line, index) => ({
      label: line.label,
      points: line.points,
      change: line.change,
      emphasis: line.emphasis,
      labelY: placed.get(index) ?? null,
    })),
  };
};

export const formatMeasure = (value: number, measure: 'share' | 'mean'): string =>
  measure === 'share' ? `${Math.round(value * 100)}%` : value.toFixed(1);

export const slopeChartSvg = (
  heading: ChartHeading,
  input: readonly SlopeInput[],
  columnLabels: readonly string[],
  measure: 'share' | 'mean',
  palette: Palette,
): ChartImage => {
  const inner = slopeLayout(input, columnLabels.length, measure, { width: WIDTH - PAD * 2, height: 520 });
  const colour = (emphasis: SlopeLine['emphasis']): string =>
    emphasis === 'up'
      ? palette.scale[4]
      : emphasis === 'down'
        ? palette.scale[0]
        : emphasis === 'top'
          ? palette.ink
          : palette.faint;
  return frame(
    heading,
    inner.height + 30,
    (top) => {
      const ox = PAD;
      const oy = top + 30;
      const grid = inner.ticks
        .map(
          (tick) =>
            `<line x1="${ox + inner.plot.left}" x2="${ox + inner.plot.right}" y1="${oy + tick.y}" y2="${oy + tick.y}" stroke="${palette.line}"/>` +
            `<text x="${ox + inner.plot.left - 8}" y="${oy + tick.y + 5}" font-size="14" text-anchor="end" fill="${palette.inkSoft}">${formatMeasure(tick.value, measure)}</text>`,
        )
        .join('');
      const heads = inner.columnX
        .map(
          (x, index) =>
            `<text x="${ox + x}" y="${top + 10}" font-size="16" font-weight="700" text-anchor="middle" fill="${palette.ink}">${escapeXml(columnLabels[index] ?? '')}</text>`,
        )
        .join('');
      const ordered = [...inner.lines].sort(
        (a, b) => (a.emphasis === 'none' ? -1 : 0) - (b.emphasis === 'none' ? -1 : 0),
      );
      const drawn = ordered
        .map((line) => {
          const stroke = colour(line.emphasis);
          const width = line.emphasis === 'none' ? 2 : 4;
          const path = line.points
            .map((point, index) => `${index === 0 ? 'M' : 'L'}${ox + point.x},${oy + point.y}`)
            .join(' ');
          const dots = line.points
            .map((point) => `<circle cx="${ox + point.x}" cy="${oy + point.y}" r="${width + 1}" fill="${stroke}"/>`)
            .join('');
          const end = line.points.at(-1);
          const label =
            line.labelY === null || end === undefined
              ? ''
              : `<text x="${ox + inner.plot.right + 14}" y="${oy + line.labelY + 5}" font-size="16" fill="${stroke === palette.faint ? palette.inkSoft : stroke}" font-weight="${line.emphasis === 'none' ? 400 : 700}">${escapeXml(
                  `${formatMeasure(end.value, measure)}  ${wrap(line.label, 30, 1)[0] ?? ''}`,
                )}</text>`;
          return `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="${width}"/>` + dots + label;
        })
        .join('');
      return grid + heads + drawn;
    },
    palette,
  );
};

// --- Word cloud ---------------------------------------------------------------

export interface CloudWordPlaced {
  readonly word: string;
  readonly size: number;
  readonly x: number;
  readonly y: number;
  readonly rotated: boolean;
}

export const cloudChartSvg = (
  heading: ChartHeading,
  words: readonly CloudWordPlaced[],
  bounds: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  palette: Palette,
): ChartImage => {
  const available = WIDTH - PAD * 2;
  const scale = Math.min(available / bounds.w, 600 / bounds.h);
  const height = bounds.h * scale;
  const tones = [palette.bar, palette.ink, palette.inkSoft];
  return frame(
    heading,
    height,
    (top) => {
      const ox = PAD + (available - bounds.w * scale) / 2;
      return words
        .map((word, index) => {
          const x = ox + (word.x - bounds.x) * scale;
          const y = top + (word.y - bounds.y) * scale;
          const rotate = word.rotated ? ` transform="rotate(-90 ${x} ${y})"` : '';
          return `<text x="${x}" y="${y}" font-size="${word.size * scale}" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="${tones[index % tones.length]}"${rotate}>${escapeXml(word.word)}</text>`;
        })
        .join('');
    },
    palette,
  );
};

// --- Saving -------------------------------------------------------------------------

export const safeFilename = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'chart';

/**
 * Draws the SVG onto a canvas at twice its size and saves a PNG — the format
 * Word and PowerPoint take without complaint. Falls back to saving the SVG if
 * the browser will not rasterise it.
 */
export const downloadChartPng = async (image: ChartImage, filename: string): Promise<void> => {
  const svgBlob = new Blob([image.svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const save = (blob: Blob, name: string): void => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  try {
    const picture = new Image();
    picture.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      picture.onload = () => resolve();
      picture.onerror = () => reject(new Error('could not draw the chart'));
      picture.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.width * 2;
    canvas.height = image.height * 2;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('no canvas');
    context.scale(2, 2);
    context.drawImage(picture, 0, 0);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (png === null) throw new Error('no png');
    save(png, `${filename}.png`);
  } catch {
    save(svgBlob, `${filename}.svg`);
  } finally {
    URL.revokeObjectURL(url);
  }
};
