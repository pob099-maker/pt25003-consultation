import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuestionnaire } from '../contexts/QuestionnaireContext';
import { formEstimates, spoken } from '../services/estimate';
import { currentProject } from '../content/projects';
import { Layout } from '../components/Layout';
import { PreferToTalk } from '../components/PreferToTalk';
import { card, primaryButton, quietButton, secondaryButton } from '../components/ui';
import { STORAGE_KEYS, readJson, removeKey } from '../lib/storage';
import { isDemoSite } from '../lib/config';

/**
 * Saved answers carry on where they left off, which is right for somebody who
 * closed the tab halfway, and wrong for a second person on the same phone, or
 * somebody who wants to start over. Said next to the buttons, where it is seen,
 * with a way to clear them.
 */
const SavedAnswers = ({ onCleared }: { onCleared: () => void }) => {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="mt-3 text-meta text-ink-soft">
      <p>You have answers saved on this device, so this carries on where you left off.</p>
      {confirming ? (
        <p className="mt-2 flex flex-wrap items-center gap-3" role="group" aria-label="Start again">
          <span>Clear them and start with a blank form?</span>
          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              removeKey(STORAGE_KEYS.draft);
              setConfirming(false);
              onCleared();
            }}
          >
            Clear and start again
          </button>
          <button type="button" className={quietButton} onClick={() => setConfirming(false)}>
            Keep them
          </button>
        </p>
      ) : (
        <button type="button" className={`${quietButton} mt-2`} onClick={() => setConfirming(true)}>
          Start again instead
        </button>
      )}
    </div>
  );
};

export const Landing = () => {
  const [hasDraft, setHasDraft] = useState(() => readJson<{ stepIndex: number }>(STORAGE_KEYS.draft) !== null);
  // Worked out from the questions actually being asked, for the role it takes
  // longest for. It used to be typed in by hand, and said five and ten minutes
  // long after the questions had grown past both.
  const questionnaire = useQuestionnaire();
  const estimates = useMemo(() => formEstimates(questionnaire), [questionnaire]);

  return (
    <Layout>
      {/* Centred as the one title on the page. The paragraphs under it stay
          left-aligned and measured: centred body text gives the eye no
          reliable left edge to return to, and this page is read, not skimmed. */}
      <h1 className="text-center">{currentProject().name} Consultation</h1>

      {/* The tour lives on the results screen now. This is the way back for
          somebody who arrived here from it, or from a link with the hash on. */}
      {isDemoSite() && (
        <p className="mt-4 text-meta text-ink-soft">
          This is the page a grower opens.{' '}
          <Link to="/admin" className="underline underline-offset-4">
            Back to the demonstration tour
          </Link>
        </p>
      )}

      <div className="prose-measure mt-5 space-y-4 text-ink-soft">
        <p>
          The Potato Mechanisation Project is asking growers, contractors, packers and the people who supply them where
          mechanisation and automation would make the most practical difference.
        </p>
        <p>
          What you tell us guides what the project takes on, including field demonstrations, case studies and the
          business-case work that follows.
        </p>
      </div>

      {questionnaire.stage === 'interim' ? (
        // An interim check is short by design, so there is nothing to choose between.
        <section className={`${card} mt-6`} aria-labelledby="how-long">
          <h2 id="how-long" className="text-subtitle font-semibold">
            A quick check-in
          </h2>
          <p className="mt-2 text-ink-soft">
            The project has taken on some new things since we last asked, so this is a short check on where people are
            at with them.
          </p>
          <div className="mt-4">
            <Link to="/about" className={primaryButton}>
              {hasDraft ? 'Continue' : `Start · ${spoken(estimates.full)}`}
            </Link>
          </div>
          {hasDraft && <SavedAnswers onCleared={() => setHasDraft(false)} />}
        </section>
      ) : (
        <section className={`${card} mt-6`} aria-labelledby="how-long">
          <h2 id="how-long" className="text-subtitle font-semibold">
            Two ways to have your say
          </h2>
          <p className="mt-2 text-ink-soft">
            Pick whichever suits the day. The short one asks what we most need to know. The full one lets you tell us more
            about your own operation. You can start short and keep going if you have the time.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link to="/about?quick=1" className={primaryButton}>
              {hasDraft ? 'Continue' : `Short version · ${spoken(estimates.short)}`}
            </Link>
            <Link to="/about" className={secondaryButton}>
              {hasDraft ? 'Continue the full version' : `Full version · ${spoken(estimates.full)}`}
            </Link>
          </div>
          {hasDraft && <SavedAnswers onCleared={() => setHasDraft(false)} />}
        </section>
      )}

      <section className={`${card} mt-6 prose-measure`} aria-labelledby="confidentiality">
        <h2 id="confidentiality" className="text-subtitle font-semibold">
          Confidentiality
        </h2>
        <p className="mt-2 text-ink-soft">
          You can answer anonymously. Results are reported as totals, and no individual person or business is named
          without permission.
        </p>
      </section>

      <PreferToTalk />

      <p className="mt-7">
        <Link to="/privacy" className={quietButton}>
          Learn how your information will be used
        </Link>
      </p>

    </Layout>
  );
};
