import { config, telHref } from '../lib/config';
import { accentPanel } from './ui';

/**
 * Plenty of the people this consultation is aimed at would rather talk than
 * fill in a form, and an online-only invitation quietly excludes them — which
 * biases the findings towards whoever is comfortable with a web page. The
 * contacts come from configuration, so another name can be added without a
 * code change, and the block disappears entirely if none is set rather than
 * making an offer with nothing behind it.
 */
export const PreferToTalk = () => {
  const contacts = config.projectContacts;
  if (contacts.length === 0) return null;

  return (
    <section className={`${accentPanel} mt-4 prose-measure`} aria-labelledby="prefer-to-talk">
      <h2 id="prefer-to-talk" className="text-subtitle font-semibold">
        Would you rather talk to someone?
      </h2>
      <p className="mt-2 text-ink-soft">
        If filling in a form does not suit you, give us a ring or send an email and we will take it over the phone, or
        arrange a time to talk it through in person. Your answers count the same either way.
      </p>
      <ul className="mt-3 grid gap-2">
        {contacts.map((contact) => (
          <li key={`${contact.name}-${contact.phone}`} className="text-body">
            <span className="font-semibold text-ink">{contact.name}</span>
            {contact.phone.length > 0 && (
              <>
                {' — '}
                <a className="font-semibold underline underline-offset-4" href={telHref(contact.phone)}>
                  {contact.phone}
                </a>
              </>
            )}
            {contact.email.length > 0 && (
              <>
                {' · '}
                <a className="underline underline-offset-4" href={`mailto:${contact.email}`}>
                  {contact.email}
                </a>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};
