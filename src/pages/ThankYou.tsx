import { useState } from 'react';
import { currentProject } from '../content/projects';
import { Link, useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { accentPanel, primaryButton, secondaryButton } from '../components/ui';
import { config } from '../lib/config';

interface ThankYouState {
  readonly queued?: boolean;
  readonly sharedContact?: boolean;
}

export const ThankYou = () => {
  const location = useLocation();
  const state = (location.state ?? {}) as ThankYouState;
  const [shareNote, setShareNote] = useState<string | null>(null);

  const share = async (): Promise<void> => {
    const url = `${window.location.origin}/`;
    const shareData = { title: `${currentProject().name} Consultation`, url };
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* The person closed the share sheet. Fall through to copying. */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareNote('Link copied. Paste it into a message or email.');
    } catch {
      setShareNote(url);
    }
  };

  return (
    <Layout>
      <h1 className="text-center">Thank you for contributing to the {currentProject().name} consultation.</h1>

      <div className="prose-measure mt-5 space-y-4 text-ink-soft">
        <p>
          What you have told us feeds straight into where the project puts its effort on mechanisation, automation and
          demonstration work.
        </p>
        <p>
          We will put together a summary of what we heard and send it out, so you can see what came of it.
          {state.sharedContact === true
            ? ' Because you provided contact details, the project team may contact you about the activities you selected.'
            : ' If you chose to provide contact details, the project team may contact you about the activities you selected.'}
        </p>
      </div>

      {state.queued === true && (
        <p className={`${accentPanel} mt-6 prose-measure`} role="status">
          Your response is saved on this device and has not been sent yet — the connection was unavailable. Open this
          page again when you have signal and it will be sent automatically. Please do not clear your browser data
          before then.
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <a className={primaryButton} href={config.homeUrl}>
          Return to the project home page
        </a>
        <Link className={secondaryButton} to="/privacy">
          View the privacy statement
        </Link>
        <button type="button" className={secondaryButton} onClick={() => void share()}>
          Invite someone else to have their say
        </button>
      </div>

      <p className="mt-3 text-meta text-ink-soft">
        Inviting someone sends them the consultation link so they can answer for themselves. Your own answers stay
        private and are never shared.
      </p>

      {shareNote !== null && (
        <p className="mt-4 text-meta text-ink-soft" role="status">
          {shareNote}
        </p>
      )}
    </Layout>
  );
};
