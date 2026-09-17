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

const RatingBars = ({ rows, answered, large }: { rows: readonly RatingRow[]; answered: number; large: boolean }) => {
  // On the big screen, unrated rows are left out and a long list takes two
  // columns, so twelve areas still fit on one slide.
  const shown = large ? rows.filter((row) => row.rated > 0) : rows;
  const columns =
    large && shown.length > 8 ? 'md:grid-cols-2 lg:grid-cols-3' : large && shown.length > 4 ? 'md:grid-cols-2' : '';
  return (
    <figure>
      <ul className={`grid ${large ? `gap-x-10 gap-y-3 ${columns}` : 'gap-3'}`}>
        {shown.map((row) => (
          <li key={row.id}>
            <div className={`flex justify-between gap-3 ${large ? 'text-subtitle font-normal' : 'text-body'}`}>
              <span className="text-ink">{row.label}</span>
              <span className="shrink-0 font-semibold text-ink">
                {row.rated === 0 ? '—' : row.mean.toFixed(1)}
                <span className="font-normal text-ink-soft"> / 5</span>
              </span>
            </div>
            {/* One segment per score, so the spread shows as well as the average. */}
            <div
              className={`mt-1 flex w-full overflow-hidden rounded-full bg-sunk ${large ? 'h-4' : 'h-3'}`}
              aria-hidden="true"
            >
              {row.scores.map((count, index) => (
                <div
                  key={index}
                  className="h-full bg-primary"
                  style={{
                    width: row.rated === 0 ? '0%' : `${(count / row.rated) * 100}%`,
                    opacity: 0.35 + index * 0.16,
                  }}
                />
              ))}
            </div>
            <p className={`mt-0.5 text-meta text-ink-soft ${large ? 'sr-only' : ''}`}>
              {row.rated === 0
                ? 'Nobody rated this.'
                : `${Math.round(row.high * 100)}% rated it 4 or 5 · ${row.rated} rated it`}
            </p>
          </li>
        ))}
      </ul>
      <figcaption className="mt-3 text-meta text-ink-soft">
        {answered} {answered === 1 ? 'person' : 'people'} answered. Darker means a higher score.
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
}: {
  words: readonly CloudWord[];
  answered: number;
  large: boolean;
  onHide?: (word: string) => void;
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
        {layout.words.length < words.length && ` ${words.length - layout.words.length} more didn’t fit.`}
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
}: {
  question: Question;
  results: Readonly<Record<string, number>>;
  answered: number;
  large?: boolean;
  onHideWord?: (word: string) => void;
}) => {
  if (isChoiceQuestion(question)) {
    return <TallyBars rows={tallyRows(question, results, answered)} answered={answered} large={large} />;
  }
  if (question.kind === 'rating') {
    return <RatingBars rows={ratingRows(question, results)} answered={answered} large={large} />;
  }
  return <WordCloud words={cloudWords(results)} answered={answered} large={large} onHide={onHideWord} />;
};
