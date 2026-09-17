import { describe, expect, it } from 'vitest';
import {
  barChartSvg,
  cloudChartSvg,
  divergingChartSvg,
  divergingSegments,
  escapeXml,
  safeFilename,
  slopeChartSvg,
  slopeLayout,
  wrap,
  type Palette,
} from './chartImage';

const palette: Palette = {
  paper: '#fff',
  ink: '#111',
  inkSoft: '#555',
  faint: '#ccc',
  line: '#eee',
  bar: '#630',
  track: '#f5f5f5',
  scale: ['#1a1a1a', '#2b2b2b', '#3c3c3c', '#4d4d4d', '#5e5e5e'],
};
const heading = { title: 'Where should we put our effort first?', note: '14 people · Ballarat field day' };

describe('escapeXml', () => {
  it('neutralises anything a respondent could type', () => {
    expect(escapeXml('<script>"a" & \'b\'')).toBe('&lt;script&gt;&quot;a&quot; &amp; &apos;b&apos;');
  });

  it('keeps typed words from breaking out of a downloaded picture', () => {
    const image = cloudChartSvg(
      heading,
      [{ word: '</text><script>x</script>', size: 40, x: 0, y: 0, rotated: false }],
      { x: -100, y: -20, w: 200, h: 40 },
      palette,
    );
    expect(image.svg).not.toContain('<script>');
  });
});

describe('wrap', () => {
  it('breaks long labels and marks what it cut', () => {
    const lines = wrap('Data capture, traceability and system integration across the whole supply chain', 20, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith('…')).toBe(true);
  });
});

describe('divergingSegments', () => {
  it('fills the right half exactly when everyone gives the top score', () => {
    expect(divergingSegments([0, 0, 0, 0, 4])).toEqual([{ key: 'r5', score: 5, start: 0.5, width: 0.5 }]);
  });

  it('centres the middle score on the line, with low to the left and high to the right', () => {
    const segments = divergingSegments([1, 1, 2, 0, 0]);
    const middle = segments.find((segment) => segment.score === 3);
    expect(middle).toMatchObject({ start: 0.375, width: 0.25 });
    const low = segments.find((segment) => segment.score === 1);
    expect((low?.start ?? 1) + (low?.width ?? 0)).toBeLessThanOrEqual(0.375);
  });

  it('draws nothing for a row nobody rated', () => {
    expect(divergingSegments([0, 0, 0, 0, 0])).toEqual([]);
  });
});

describe('slopeLayout', () => {
  const input = [
    { label: 'Harvest', values: [0.4, 0.62] },
    { label: 'Skills', values: [0.5, 0.3] },
    { label: 'Storage', values: [0.2, 0.21] },
    { label: 'Packing', values: [0.1, 0.1] },
    { label: 'Receival', values: [0.05, null] },
  ];
  const layout = slopeLayout(input, 2, 'share');

  it('colours the rows that moved, in the direction they moved', () => {
    expect(layout.lines.find((line) => line.label === 'Harvest')?.emphasis).toBe('up');
    expect(layout.lines.find((line) => line.label === 'Skills')?.emphasis).toBe('down');
    expect(layout.lines.find((line) => line.label === 'Packing')?.emphasis).toBe('none');
  });

  it('draws higher values higher up', () => {
    const harvest = layout.lines.find((line) => line.label === 'Harvest');
    expect((harvest?.points[1]?.y ?? 0) < (harvest?.points[0]?.y ?? 0)).toBe(true);
  });

  it('leaves out a round nobody answered rather than drawing it at zero', () => {
    expect(layout.lines.find((line) => line.label === 'Receival')?.points).toHaveLength(1);
  });

  it('keeps end labels from sitting on top of each other', () => {
    const ys = layout.lines
      .map((line) => line.labelY)
      .filter((y): y is number => y !== null)
      .sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i += 1) expect((ys[i] ?? 0) - (ys[i - 1] ?? 0)).toBeGreaterThanOrEqual(21.9);
  });

  it('uses the full 1-to-5 range for ratings', () => {
    const ratings = slopeLayout([{ label: 'A', values: [3, 4] }], 2, 'mean');
    expect(ratings.ticks.map((tick) => tick.value)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('chart pictures', () => {
  it('draws a bar chart with every label and value', () => {
    const image = barChartSvg(heading, [{ label: 'Harvesting', value: 0.64, text: '9 · 64%' }], palette);
    expect(image.svg).toContain('Harvesting');
    expect(image.svg).toContain('9 · 64%');
    expect(image.svg.startsWith('<svg')).toBe(true);
  });

  it('draws a diverging chart with its scale key', () => {
    const image = divergingChartSvg(
      heading,
      [{ label: 'Robotics', scores: [1, 2, 3, 4, 5], text: '3.7' }],
      ['Not a priority', 'Very high priority'],
      palette,
    );
    expect(image.svg).toContain('Not a priority');
    expect(image.svg).toContain('Robotics');
  });

  it('draws a change-over-time chart with a heading per round', () => {
    const image = slopeChartSvg(heading, [{ label: 'Harvest', values: [0.4, 0.62] }], ['Baseline', 'Review'], 'share', palette);
    expect(image.svg).toContain('Baseline');
    expect(image.svg).toContain('62%');
  });

  it('makes a tidy file name', () => {
    expect(safeFilename('What’s the part of the job that gives the most grief?')).toBe(
      'what-s-the-part-of-the-job-that-gives-the-most-grief',
    );
  });
});
