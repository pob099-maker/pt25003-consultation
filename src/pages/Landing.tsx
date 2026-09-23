import { Link } from 'react-router-dom';
import { currentProject } from '../content/projects';
import { Layout } from '../components/Layout';
import { PreferToTalk } from '../components/PreferToTalk';
import { card, primaryButton, quietButton, secondaryButton } from '../components/ui';
import { STORAGE_KEYS, readJson } from '../lib/storage';
import { isDemoSite } from '../lib/config';
import { DemoWelcome } from '../components/DemoWelcome';

export const Landing = () => {
  const hasDraft = readJson<{ stepIndex: number }>(STORAGE_KEYS.draft) !== null;

  return (
    <Layout>
      {/* Centred as the one title on the page. The paragraphs under it stay
          left-aligned and measured: centred body text gives the eye no
          reliable left edge to return to, and this page is read, not skimmed. */}
      <h1 className="text-center">{currentProject().name} Consultation</h1>

      {isDemoSite() && <DemoWelcome />}

      <div className="prose-measure mt-5 space-y-4 text-ink-soft">
        <p>
          The Potato Mechanisation Project is seeking practical input from across the Australian potato industry to help
          identify priority opportunities for mechanisation, automation, digital tools, demonstrations and practical
          extension.
        </p>
        <p>
          Your feedback will help guide future project activities, including case studies, field demonstrations,
          business-case tools and PotatoLink resources.
        </p>
      </div>

      <section className={`${card} mt-6`} aria-labelledby="how-long">
        <h2 id="how-long" className="text-subtitle font-semibold">
          Two ways to have your say
        </h2>
        <p className="mt-2 text-ink-soft">
          Pick whichever suits the day. The short one asks the questions we most need answered; the full one lets you
          tell us more about your own operation. You can start short and keep going if you have time.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Link to="/about?quick=1" className={primaryButton}>
            {hasDraft ? 'Continue' : 'Short version · about 5 minutes'}
          </Link>
          <Link to="/about" className={secondaryButton}>
            {hasDraft ? 'Continue the full version' : 'Full version · about 10 minutes'}
          </Link>
        </div>
      </section>

      <section className={`${card} mt-6 prose-measure`} aria-labelledby="confidentiality">
        <h2 id="confidentiality" className="text-subtitle font-semibold">
          Confidentiality
        </h2>
        <p className="mt-2 text-ink-soft">
          You can respond anonymously. Findings will be reported in aggregated form and will not identify individual
          people or businesses without permission.
        </p>
      </section>

      <PreferToTalk />

      <p className="mt-7">
        <Link to="/privacy" className={quietButton}>
          Learn how your information will be used
        </Link>
      </p>

      {hasDraft && (
        <p className="mt-4 text-meta text-ink-soft">
          You have answers saved on this device. You can pick up where you left off.
        </p>
      )}
    </Layout>
  );
};
