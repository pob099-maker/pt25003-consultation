interface Props {
  readonly current: number;
  readonly total: number;
  readonly label: string;
}

export const ProgressIndicator = ({ current, total, label }: Props) => {
  const percent = Math.round(((current + 1) / total) * 100);
  return (
    <div className="mb-5 no-print">
      <p className="mb-1 text-meta font-semibold text-ink-soft">
        Step {current + 1} of {total} — {label}
      </p>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current + 1}
        aria-valuetext={`Step ${current + 1} of ${total}`}
        className="h-2 w-full overflow-hidden rounded-full bg-sunk"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};
