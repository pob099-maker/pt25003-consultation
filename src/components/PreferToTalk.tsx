import { config } from '../lib/config';
import { card } from './ui';

/**
 * Plenty of the people this consultation is aimed at would rather talk than
 * fill in a form, and an online-only invitation quietly excludes them. The
 * phone number appears only when one is configured, so the offer is never made
 * with nothing behind it.
 */
export const PreferToTalk = ({ tone = 'panel' }: { tone?: 'panel' | 'plain' }) => {
  const hasPhone = config.contactPhone.trim().length > 0;

  const body = (
    <>
      <p className={tone === 'panel' ? 'text-ink-soft' : 'text-meta text-ink-soft'}>
        If filling in a form online does not suit you, you do not have to. Ring or email the project team and somebody
        will take your input over the phone, or arrange a time to talk it through in person. Your answers count the
        same either way.
      </p>
      <p className={`mt-2 ${tone === 'panel' ? 'text-body' : 'text-meta'}`}>
        {hasPhone && (
          <>
            <a className="font-semibold underline underline-offset-4" href={`tel:${config.contactPhone.replace(/\s+/g, '')}`}>
              {config.contactPhone}
            </a>
            {' · '}
          </>
        )}
        <a className="underline underline-offset-4" href={`mailto:${config.privacyContactEmail}`}>
          {config.privacyContactEmail}
        </a>
      </p>
    </>
  );

  if (tone === 'plain') return <div className="mt-6 prose-measure">{body}</div>;

  return (
    <section className={`${card} mt-4 prose-measure`} aria-labelledby="prefer-to-talk">
      <h2 id="prefer-to-talk" className="text-subtitle font-semibold">
        Would you rather talk to someone?
      </h2>
      <div className="mt-2">{body}</div>
    </section>
  );
};
