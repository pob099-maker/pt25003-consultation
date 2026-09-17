import { useState } from 'react';
import { browserSaysDoNotTrack, progressAllowed, setProgressOptOut } from '../services/progress';

/**
 * The off switch for the "how far you got" record.
 *
 * Worded as what it does, not as a setting: a checkbox that says "don't record
 * how far I get" is understood at a glance, where "progress analytics" is not.
 * When the browser has already said no, the switch says so rather than
 * offering a choice that has been made.
 */
export const ProgressOptOut = () => {
  const blockedByBrowser = browserSaysDoNotTrack();
  const [optedOut, setOptedOut] = useState(() => !progressAllowed());

  if (blockedByBrowser) {
    return (
      <p className="mt-3 text-meta text-ink-soft">
        Your browser has asked sites not to track you, so we are not recording how far you get.
      </p>
    );
  }

  return (
    <label className="mt-3 flex cursor-pointer items-start gap-3 text-body text-ink">
      <input
        type="checkbox"
        className="mt-1 size-5 shrink-0 accent-primary"
        checked={optedOut}
        onChange={(event) => {
          setOptedOut(event.target.checked);
          setProgressOptOut(event.target.checked);
        }}
      />
      <span>
        Don&rsquo;t record how far I get
        <span className="block text-meta text-ink-soft">
          It only ever holds a step number — never your answers — and helps us spot a section that is too long. Your
          answers count the same either way.
        </span>
      </span>
    </label>
  );
};
