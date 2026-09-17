import type { TallyRow } from '../services/workshops';

/** Horizontal bars, labelled with the count and share, readable from the back of a room. */
export const TallyBars = ({
  rows,
  answered,
  large = false,
}: {
  rows: readonly TallyRow[];
  answered: number;
  large?: boolean;
}) => {
  // On the big screen, options nobody chose are summarised rather than drawn,
  // so a fourteen-option question still fits without scrolling.
  const shown = large ? rows.filter((row) => row.hands > 0) : rows;
  const empty = rows.length - shown.length;
  const columns =
    large && shown.length > 8 ? 'md:grid-cols-2 lg:grid-cols-3' : large && shown.length > 5 ? 'md:grid-cols-2' : '';
  return (
    <figure>
      <ul className={`grid ${large ? `gap-x-10 gap-y-3 ${columns}` : 'gap-2'}`}>
        {shown.map((row) => (
          <li key={row.id}>
            <div className={`flex justify-between gap-3 ${large ? 'text-subtitle font-normal' : 'text-body'}`}>
              <span className="text-ink">{row.label}</span>
              <span className="shrink-0 font-semibold text-ink">
                {row.hands} <span className="font-normal text-ink-soft">· {Math.round(row.share * 100)}%</span>
              </span>
            </div>
            <div className={`mt-1 w-full overflow-hidden rounded-full bg-sunk ${large ? 'h-4' : 'h-3'}`}>
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(row.share * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <figcaption className="mt-3 text-meta text-ink-soft">
        {answered} {answered === 1 ? 'person' : 'people'} answered. Shares are of the people who answered.
        {empty > 0 && ` ${empty} other ${empty === 1 ? 'option' : 'options'} had no votes.`}
      </figcaption>
    </figure>
  );
};
