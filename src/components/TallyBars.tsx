import type { TallyRow } from '../services/workshops';

/** Horizontal bars, labelled with the count and share, readable from the back of a room. */
export const TallyBars = ({ rows, answered, large = false }: { rows: readonly TallyRow[]; answered: number; large?: boolean }) => (
  <figure>
    <ul className={`grid ${large ? 'gap-4' : 'gap-2'}`}>
      {rows.map((row) => (
        <li key={row.id}>
          <div className={`flex justify-between gap-3 ${large ? 'text-subtitle' : 'text-body'}`}>
            <span className="text-ink">{row.label}</span>
            <span className="shrink-0 font-semibold text-ink">
              {row.hands} <span className="font-normal text-ink-soft">· {Math.round(row.share * 100)}%</span>
            </span>
          </div>
          <div className={`mt-1 w-full overflow-hidden rounded-full bg-sunk ${large ? 'h-5' : 'h-3'}`}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(row.share * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
    <figcaption className="mt-3 text-meta text-ink-soft">
      {answered} {answered === 1 ? 'person' : 'people'} answered. Shares are of the people who answered.
    </figcaption>
  </figure>
);
