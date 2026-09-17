import { useMemo } from 'react';
import { formatMeasure, slopeLayout, wrap, type SlopeInput, type SlopeLine } from '../lib/chartImage';

const STROKE: Readonly<Record<SlopeLine['emphasis'], string>> = {
  up: 'stroke-scale-5',
  down: 'stroke-scale-1',
  top: 'stroke-ink',
  none: 'stroke-line-strong',
};

const FILL: Readonly<Record<SlopeLine['emphasis'], string>> = {
  up: 'fill-scale-5',
  down: 'fill-scale-1',
  top: 'fill-ink',
  none: 'fill-ink-faint',
};

/**
 * Baseline to each review, one line per option. The biggest movers are
 * coloured — gold-brown for up, slate for down — and the three highest at the
 * end are labelled in ink. Everything else is a faint line, there for context.
 */
export const SlopeChart = ({
  input,
  columns,
  measure,
  label,
}: {
  input: readonly SlopeInput[];
  columns: readonly string[];
  measure: 'share' | 'mean';
  label: string;
}) => {
  const layout = useMemo(() => slopeLayout(input, columns.length, measure), [input, columns.length, measure]);
  const ordered = [...layout.lines].sort((a, b) => (a.emphasis === 'none' ? -1 : 0) - (b.emphasis === 'none' ? -1 : 0));
  const top = 34;
  return (
    <svg
      viewBox={`-40 0 ${layout.width + 50} ${layout.height + top}`}
      className="w-full min-w-[36rem]"
      role="img"
      aria-label={label}
    >
      {columns.map((column, index) => (
        <text
          key={column}
          x={layout.columnX[index]}
          y={16}
          fontSize={15}
          textAnchor="middle"
          className="fill-ink font-semibold"
        >
          {column}
        </text>
      ))}
      <g transform={`translate(0 ${top})`}>
        {layout.ticks.map((tick) => (
          <g key={tick.value}>
            <line x1={layout.plot.left} x2={layout.plot.right} y1={tick.y} y2={tick.y} className="stroke-line" />
            <text x={layout.plot.left - 8} y={tick.y + 4} fontSize={12} textAnchor="end" className="fill-ink-faint">
              {formatMeasure(tick.value, measure)}
            </text>
          </g>
        ))}
        {ordered.map((line) => {
          const width = line.emphasis === 'none' ? 1.5 : 3.5;
          const end = line.points.at(-1);
          return (
            <g key={line.label}>
              <title>
                {`${line.label}: ${line.points.map((point) => formatMeasure(point.value, measure)).join(' → ')}`}
              </title>
              <path
                d={line.points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ')}
                fill="none"
                strokeWidth={width}
                className={STROKE[line.emphasis]}
              />
              {line.points.map((point) => (
                <circle key={point.x} cx={point.x} cy={point.y} r={width + 1} className={FILL[line.emphasis]} />
              ))}
              {line.labelY !== null && end !== undefined && (
                <text
                  x={layout.plot.right + 12}
                  y={line.labelY + 4}
                  fontSize={14}
                  className={`${FILL[line.emphasis]} ${line.emphasis === 'none' ? '' : 'font-semibold'}`}
                >
                  {`${formatMeasure(end.value, measure)}  ${wrap(line.label, 34, 1)[0] ?? ''}`}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
};
