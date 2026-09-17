import { useId } from 'react';
import { textInput } from './ui';

/**
 * A running notebook for the section on screen: the good quote, the side
 * story, the thing that does not fit a question. Filed under this section and
 * shown in the comments tab with every other written answer.
 */
export const InterviewNotes = ({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
}) => {
  const id = useId();
  return (
    <section className="rounded-lg border border-dashed border-line-strong bg-sunk p-4">
      <label htmlFor={id} className="block text-body font-semibold text-ink">
        Notes and quotes — {title}
      </label>
      <p id={`${id}-help`} className="mt-0.5 text-meta text-ink-soft">
        Anything worth keeping that doesn&rsquo;t fit a question. Put quotes in &ldquo;quote marks&rdquo;. Leave out
        names — theirs and anyone they mention.
      </p>
      <textarea
        id={id}
        aria-describedby={`${id}-help`}
        rows={3}
        maxLength={4000}
        className={`${textInput} mt-2`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  );
};
