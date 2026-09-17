import type { Question } from '../types';
import {
  cloudWords,
  isChoiceQuestion,
  ratingRows,
  tallyRows,
  type CloudWord,
  type RatingRow,
} from '../services/workshops';
import { TallyBars } from './TallyBars';

const RatingBars = ({ rows, answered, large }: { rows: readonly RatingRow[]; answered: number; large: boolean }) => (
  <figure>
    <ul className={`grid ${large ? 'gap-4' : 'gap-3'}`}>
      {rows.map((row) => (
        <li key={row.id}>
          <div className={`flex justify-between gap-3 ${large ? 'text-subtitle' : 'text-body'}`}>
            <span className="text-ink">{row.label}</span>
            <span className="shrink-0 font-semibold text-ink">
              {row.rated === 0 ? '—' : row.mean.toFixed(1)}
              <span className="font-normal text-ink-soft"> / 5</span>
            </span>
          </div>
          {/* One segment per score, so the spread shows as well as the average. */}
          <div
            className={`mt-1 flex w-full overflow-hidden rounded-full bg-sunk ${large ? 'h-5' : 'h-3'}`}
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
          <p className="mt-0.5 text-meta text-ink-soft">
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
  const top = words[0]?.count ?? 1;
  const [min, max] = large ? [1.1, 4.5] : [0.95, 2.4];
  return (
    <figure>
      {words.length === 0 ? (
        <p className="text-body text-ink-soft">Nothing to show.</p>
      ) : (
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 py-4">
          {words.map((item, index) => {
            const size = min + (max - min) * (top === 1 ? 1 : (item.count - 1) / (top - 1));
            const style = { fontSize: `${size.toFixed(2)}rem`, lineHeight: 1.1 };
            const tone = index % 3 === 0 ? 'text-primary-ink' : index % 3 === 1 ? 'text-ink' : 'text-ink-soft';
            const label = `${item.word}, ${item.count} ${item.count === 1 ? 'person' : 'people'}`;
            return (
              <li key={item.word}>
                {onHide === undefined ? (
                  <span className={`font-display font-bold ${tone}`} style={style} title={label}>
                    {item.word}
                  </span>
                ) : (
                  <button
                    type="button"
                    className={`font-display font-bold ${tone} rounded hover:line-through`}
                    style={style}
                    title={`${label} — click to hide`}
                    aria-label={`Hide "${item.word}" from the screen`}
                    onClick={() => onHide(item.word)}
                  >
                    {item.word}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <figcaption className="mt-2 text-meta text-ink-soft">
        {answered} {answered === 1 ? 'person' : 'people'} answered. Bigger means more people said it.
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
