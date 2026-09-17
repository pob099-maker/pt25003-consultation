import { divergingSegments } from '../lib/chartImage';

const FILL = ['bg-scale-1', 'bg-scale-2', 'bg-scale-3', 'bg-scale-4', 'bg-scale-5'] as const;

/**
 * One row of a 1-to-5 rating, split at the middle score: low scores run left
 * of the centre line, high scores right, and the middle score straddles it.
 * The eye reads which way a row leans before it reads any number.
 */
export const DivergingBar = ({ scores, large = false }: { scores: readonly number[]; large?: boolean }) => {
  const segments = divergingSegments(scores);
  return (
    <div className={`relative w-full ${large ? 'h-5' : 'h-3.5'}`} aria-hidden="true">
      {segments.map((segment) => (
        <div
          key={segment.key}
          className={`absolute inset-y-0 ${FILL[segment.score - 1]}`}
          style={{ left: `${segment.start * 100}%`, width: `${segment.width * 100}%` }}
        />
      ))}
      {/* Drawn last, so the middle stays visible through the blocks. */}
      <div className="absolute -inset-y-0.5 left-1/2 w-0.5 -translate-x-1/2 bg-ink-soft" />
    </div>
  );
};

/** The key for a diverging chart: five swatches, labelled at each end. */
export const ScaleLegend = ({ low, high }: { low: string; high: string }) => (
  <p className="flex flex-wrap items-center gap-2 text-meta text-ink-soft">
    <span>{low}</span>
    <span className="flex" aria-hidden="true">
      {FILL.map((fill) => (
        <span key={fill} className={`size-3.5 ${fill}`} />
      ))}
    </span>
    <span>{high}</span>
  </p>
);
