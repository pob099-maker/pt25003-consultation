import { useEffect, useMemo, useState } from 'react';
import type { Question } from '../types';
import { estimateWidth, layoutCloud } from '../services/wordCloud';
import {
  cloudWords,
  isChoiceQuestion,
  ratingRows,
  tallyRows,
  type CloudWord,
  type RatingRow,
} from '../services/workshops';
import { TallyBars } from './TallyBars';
import { DivergingBar, ScaleLegend } from './DivergingBar';
import { DownloadChartButton } from './DownloadChartButton';
import { barChartSvg, cloudChartSvg, divergingChartSvg, type ChartHeading } from '../lib/chartImage';

const RatingBars = ({
  rows,
  answered,
  large,
  scale,
  heading,
}: {
  rows: readonly RatingRow[];
  answered: number;
  large: boolean;
  scale: readonly [string, string];
  heading?: ChartHeading;
}) => {
  // On the big screen, unrated rows are left out and a long list takes two
  // columns, so twelve areas still fit on one slide.
  const shown = large ? rows.filter((row) => row.rated > 0) : rows;
  const columns =
    large && shown.length > 8 ? 'md:grid-cols-2 lg:grid-cols-3' : large && shown.length > 4 ? 'md:grid-cols-2' : '';
  return (
    <figure>
      {!large && (
        <div className="mb-3">
          <ScaleLegend low={scale[0]} high={scale[1]} />
        </div>
      )}
      <ul className={`grid ${large ? `gap-x-10 gap-y-2 ${columns}` : 'gap-3'}`}>
        {shown.map((row) => (
          <li key={row.id}>
            <div className={`flex justify-between gap-3 ${large ? 'text-subtitle font-normal' : 'text-body'}`}>
              <span className="text-ink">{row.label}</span>
              <span className="shrink-0 font-semibold text-ink">
                {row.rated === 0 ? '—' : row.mean.toFixed(1)}
                <span className="font-normal text-ink-soft"> / 5</span>
              </span>
            </div>
            <div className="mt-1">
              <DivergingBar scores={row.scores} large={large} />
            </div>
            <p className={`mt-0.5 text-meta text-ink-soft ${large ? 'sr-only' : ''}`}>
              {row.rated === 0
                ? 'Nobody rated this.'
                : `${Math.round(row.high * 100)}% rated it 4 or 5 · ${row.rated} rated it`}
            </p>
          </li>
        ))}
      </ul>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-soft">
        {large && <ScaleLegend low={scale[0]} high={scale[1]} />}
        <span>
          {answered} {answered === 1 ? 'person' : 'people'} answered. Low scores run left of the line, high scores
          right.
        </span>
        {heading !== undefined && (
          <DownloadChartButton
            name={heading.title}
            build={(palette) =>
              divergingChartSvg(
                heading,
                rows
                  .filter((row) => row.rated > 0)
                  .map((row) => ({ label: row.label, scores: row.scores, text: `${row.mean.toFixed(1)} / 5` })),
                scale,
                palette,
              )
            }
          />
        )}
      </figcaption>
    </figure>
  );
};

/** Measures text in the display face, so the layout matches what is drawn. */
const useMeasure = () => {
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return useMemo(() => {
    const context = document.createElement('canvas').getContext('2d');
    if (context === null) return estimateWidth;
    const family = getComputedStyle(document.documentElement).getPropertyValue('--font-display') || 'sans-serif';
    return (word: string, size: number): number => {
      context.font = `700 ${size}px ${family}`;
      return context.measureText(word).width;
    };
    // fontsReady: measure again once the real typeface has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsReady]);
};

const TONES = ['fill-primary-ink', 'fill-ink', 'fill-ink-soft'] as const;

const WordCloud = ({
  words,
  answered,
  large,
  onHide,
  heading,
}: {
  words: readonly CloudWord[];
  answered: number;
  large: boolean;
  onHide?: (word: string) => void;
  heading?: ChartHeading;
}) => {
  const measure = useMeasure();
  const layout = useMemo(() => {
    const top = words[0]?.count ?? 1;
    const input = words.map((item) => ({
      word: item.word,
      // Area, not height, should follow the count, so size grows with its square root.
      size: 30 + 70 * (top === 1 ? 1 : Math.sqrt((item.count - 1) / (top - 1))),
    }));
    return layoutCloud(input, measure, large ? 2 : 1.3);
  }, [words, measure, large]);
  const counts = new Map(words.map((item) => [item.word, item.count]));
  const margin = 12;
  const { x, y, w, h } = layout.bounds;

  return (
    <figure>
      {layout.words.length === 0 ? (
        <p className="text-body text-ink-soft">Nothing to show.</p>
      ) : (
        <svg
          viewBox={`${x - margin} ${y - margin} ${w + margin * 2} ${h + margin * 2}`}
          className="mx-auto block w-full"
          style={{ maxHeight: large ? '40vh' : '60vh' }}
          role="img"
          aria-label={`Word cloud: ${words.map((item) => `${item.word} (${item.count})`).join(', ')}`}
        >
          {layout.words.map((placed, index) => {
            const count = counts.get(placed.word) ?? 0;
            const title = `${placed.word}: ${count} ${count === 1 ? 'person' : 'people'}`;
            const hide = onHide === undefined ? undefined : () => onHide(placed.word);
            return (
              <text
                key={placed.word}
                x={placed.x}
                y={placed.y}
                fontSize={placed.size}
                textAnchor="middle"
                dominantBaseline="central"
                transform={placed.rotated ? `rotate(-90 ${placed.x} ${placed.y})` : undefined}
                className={`font-display font-bold ${TONES[index % TONES.length]} ${
                  hide === undefined ? '' : 'cursor-pointer hover:line-through'
                }`}
                role={hide === undefined ? undefined : 'button'}
                tabIndex={hide === undefined ? undefined : 0}
                aria-label={hide === undefined ? undefined : `Hide "${placed.word}" from the screen`}
                onClick={hide}
                onKeyDown={
                  hide === undefined
                    ? undefined
                    : (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          hide();
                        }
                      }
                }
              >
                <title>{hide === undefined ? title : `${title} — click to hide`}</title>
                {placed.word}
              </text>
            );
          })}
        </svg>
      )}
      <figcaption className="mt-2 text-meta text-ink-soft">
        {answered} {answered === 1 ? 'person' : 'people'} answered. Bigger means more people said it.
        {layout.words.length < words.length && ` ${words.length - layout.words.length} more didn’t fit.`}{' '}
        {heading !== undefined && layout.words.length > 0 && (
          <DownloadChartButton
            name={heading.title}
            build={(palette) => cloudChartSvg(heading, layout.words, layout.bounds, palette)}
          />
        )}
      </figcaption>
    </figure>
  );
};

/** The right picture for the kind of question: bars, averages or a word cloud. */
export const WorkshopResults = ({
  question,
  results,
  answered,
  large = false,
  onHideWord,
  heading,
}: {
  question: Question;
  results: Readonly<Record<string, number>>;
  answered: number;
  large?: boolean;
  onHideWord?: (word: string) => void;
  /** When given, a "Download chart" link is offered with this title and note. */
  heading?: ChartHeading;
}) => {
  if (isChoiceQuestion(question)) {
    const rows = tallyRows(question, results, answered);
    return (
      <>
        <TallyBars rows={rows} answered={answered} large={large} />
        {heading !== undefined && (
          <DownloadChartButton
            name={heading.title}
            build={(palette) =>
              barChartSvg(
                heading,
                rows
                  .filter((row) => row.hands > 0)
                  .map((row) => ({
                    label: row.label,
                    value: row.share,
                    text: `${row.hands} · ${Math.round(row.share * 100)}%`,
                  })),
                palette,
              )
            }
          />
        )}
      </>
    );
  }
  if (question.kind === 'rating') {
    const scale: [string, string] = [question.scale[0]?.label ?? 'Low', question.scale.at(-1)?.label ?? 'High'];
    return (
      <RatingBars
        rows={ratingRows(question, results)}
        answered={answered}
        large={large}
        scale={scale}
        heading={heading}
      />
    );
  }
  return (
    <WordCloud words={cloudWords(results)} answered={answered} large={large} onHide={onHideWord} heading={heading} />
  );
};
