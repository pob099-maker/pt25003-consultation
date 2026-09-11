import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { card, primaryButton, secondaryButton } from '../components/ui';
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
    const shareData = { title: 'Potato Mechanisation Project Consultation', url };
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
      <h1 className="prose-measure">Thank you for contributing to the Potato Mechanisation Project consultation.</h1>

      <div className="prose-measure mt-5 space-y-4 text-ink-soft">
        <p>
          Your input will help identify practical priorities for mechanisation, automation, demonstration and extension
          across the potato industry.
        </p>
        <p>
          We will use responses to develop a “what we heard” summary and guide future project activities.
          {state.sharedContact === true
            ? ' Because you provided contact details, the project team may contact you about the activities you selected.'
            : ' If you chose to provide contact details, the project team may contact you about the activities you selected.'}
        </p>
      </div>

      {state.queued === true && (
        <p className={`${card} mt-6 prose-measure border-accent/40 bg-accent-soft`} role="status">
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
          Share with a colleague
        </button>
      </div>

      {shareNote !== null && (
        <p className="mt-4 text-meta text-ink-soft" role="status">
          {shareNote}
        </p>
      )}
    </Layout>
  );
};
