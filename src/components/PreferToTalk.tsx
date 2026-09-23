import { config, telHref } from '../lib/config';
import { CallbackRequest } from './CallbackRequest';
import { accentPanel } from './ui';

/**
 * Plenty of the people this consultation is aimed at would rather talk than
 * fill in a form, and an online-only invitation quietly excludes them — which
 * biases the findings towards whoever is comfortable with a web page.
 *
 * Two ways in, because they suit different people. A number to ring suits
 * somebody who wants it dealt with now; leaving a number suits somebody who
 * is in a tractor and cannot talk, and it does not depend on one person
 * answering their mobile. The numbers come from configuration, so another name
 * can be added without a code change, and the list disappears rather than
 * making an offer with nothing behind it. The callback offer stands either
 * way: it needs nobody's number published.
 */
export const PreferToTalk = () => {
  const contacts = config.projectContacts;

  return (
    <section className={`${accentPanel} mt-4 prose-measure`} aria-labelledby="prefer-to-talk">
      <h2 id="prefer-to-talk" className="text-subtitle font-semibold">
        Would you rather talk to someone?
      </h2>
      <p className="mt-2 text-ink-soft">
        If filling in a form does not suit you, we can take it over the phone instead, or arrange a time to talk it
        through in person. Your answers count the same either way.
      </p>
      {contacts.length > 0 && (
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
      )}
      <CallbackRequest />
    </section>
  );
};
