import { useMemo, useState } from 'react';
import { MarkdownView } from '../../components/MarkdownView';
import { accentPanel, card, primaryButton, secondaryButton, textInput } from '../../components/ui';
import { buildPhoneScript } from '../../content/phoneScript';
import { useQuestionnaire } from '../../contexts/QuestionnaireContext';
import { downloadText } from '../../lib/csv';
import { config, telHref } from '../../lib/config';

/**
 * The script for taking a consultation over the phone, on screen and ready to
 * read — not only as a file to find and open.
 *
 * It used to be a download button on the wording tab, which is the wrong home:
 * editing questions and taking a call are different jobs, and nobody with
 * somebody already on the line is going to hunt through a settings screen.
 *
 * Built from the questionnaire that is live right now, wording changes
 * included, so the call asks exactly what the form asks.
 */
export const PhoneScriptPanel = () => {
  const questionnaire = useQuestionnaire();
  const script = useMemo(() => buildPhoneScript(questionnaire), [questionnaire]);
  const [filter, setFilter] = useState('');

  /**
   * A call is one branch, not all six. Typing a role name cuts the script to
   * the sections that mention it, so the person on the phone is not scrolling
   * past a packhouse while a contractor waits.
   */
  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (needle.length === 0) return script;
    const sections = script.split(/\n(?=### )/);
    const [head, ...rest] = sections;
    const kept = rest.filter((section) => section.toLowerCase().includes(needle));
    return kept.length === 0 ? script : [head, ...kept].join('\n');
  }, [script, filter]);

  return (
    <div className="mt-6 grid gap-5">
      <section className={accentPanel}>
        <h2 className="text-subtitle font-semibold">Taking a response over the phone</h2>
        <p className="mt-2 text-ink-soft">
          Work down this script and enter the answers into the consultation afterwards, so a phone response sits in
          the same data as everybody else&rsquo;s. If we only hear from people comfortable with an online form, the
          findings quietly skew towards them.
        </p>
        <p className="mt-2 text-meta text-ink-soft">
          It follows the wording that is live now, so it changes when you change a question. The landing page offers
          the call in the first place
          {config.projectContacts.length > 0 && (
            <>
              {' '}
              — currently{' '}
              {config.projectContacts.map((contact, index) => (
                <span key={contact.name}>
                  {index > 0 ? ', ' : ''}
                  {contact.name}
                  {contact.phone.length > 0 && (
                    <>
                      {' on '}
                      <a className="underline underline-offset-4" href={telHref(contact.phone)}>
                        {contact.phone}
                      </a>
                    </>
                  )}
                </span>
              ))}
            </>
          )}
          .
        </p>
        <div className="mt-4 flex flex-wrap gap-3 no-print">
          <button
            type="button"
            className={primaryButton}
            onClick={() =>
              downloadText(
                `pt25003-phone-script-${new Date().toISOString().slice(0, 10)}.md`,
                script,
                'text/markdown',
              )
            }
          >
            Download a copy
          </button>
          <button type="button" className={secondaryButton} onClick={() => window.print()}>
            Print
          </button>
        </div>
      </section>

      <section className={`${card} no-print`}>
        <label htmlFor="script-filter" className="mb-1 block text-meta font-semibold text-ink-soft">
          Show one branch only
        </label>
        <input
          id="script-filter"
          className={textInput}
          placeholder="For example: contractor, packhouse, machinery"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <p className="mt-1 text-meta text-ink-faint">
          The shared questions always stay. Leave it blank for the whole script.
        </p>
      </section>

      <article className={card}>
        <MarkdownView source={shown} />
      </article>
    </div>
  );
};
