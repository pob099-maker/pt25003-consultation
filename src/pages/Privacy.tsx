import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { config } from '../lib/config';
import { secondaryButton } from '../components/ui';
import { ProgressOptOut } from '../components/ProgressOptOut';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-7 prose-measure">
    <h2 className="text-subtitle font-semibold">{title}</h2>
    <div className="mt-2 space-y-3 text-ink-soft">{children}</div>
  </section>
);

export const Privacy = () => (
  <Layout>
    <h1 className="prose-measure">Privacy statement</h1>
    <p className="prose-measure mt-4 text-ink-soft">
      This statement covers the online consultation for the Potato Mechanisation Project (PT25003).
    </p>

    <Section title="What information is collected">
      <p>The consultation collects three separate kinds of information, held apart from each other.</p>
      <p>
        <strong className="text-ink">Anonymous consultation responses.</strong> Your role category, the regions you
        selected, which question pathway you were shown, your answers, any free-text comments, and the date of
        submission. No name, business name or contact detail is required at any point.
      </p>
      <p>
        <strong className="text-ink">A record of how far you got.</strong> While you work through the consultation we
        record which step you reached and which set of questions you were shown, so we can see whether a section is too
        long and fix it. That record holds no answers and nothing you typed — only the step number — and it is not
        connected to your responses or to any contact details. It exists so that somebody who gives up halfway tells us
        something, instead of vanishing. It is on unless you switch it off, and it is off automatically if your browser
        sends a do-not-track privacy signal.
      </p>
      <ProgressOptOut />
      <p>
        <strong className="text-ink">Optional contact and expression-of-interest details.</strong> Only if you ask to be
        contacted: your name, organisation, broad role, region, email address, phone number, preferred contact method and
        time, the activities you are interested in, and any comments you add.
      </p>
    </Section>

    <Section title="Why it is collected">
      <p>
        To identify practical priorities for mechanisation, automation, demonstration and extension across the Australian
        potato industry, and to shape the activities the project undertakes.
      </p>
    </Section>

    <Section title="How it will be used">
      <p>
        Consultation responses are analysed together and reported in aggregate — for example, the constraints most often
        ranked highest, or how priorities differ between regions. Free-text comments may be quoted in a “what we heard”
        summary only where they cannot identify a person or a business.
      </p>
      <p>
        Contact details are used only to contact you about the activities you selected. They are stored separately from
        the consultation responses, and the two are not linked: the project team cannot see which set of answers a
        contact record came from.
      </p>
    </Section>

    <Section title="Who can see it">
      <p>
        Consultation data is held in a database that only the project team can read. Contact details are restricted to
        project administrators. Nothing is sold, and nothing is shared for marketing.
      </p>
    </Section>

    <Section title="Questions about privacy">
      <p>
        Contact {config.privacyContactName} at{' '}
        <a className="underline underline-offset-4" href={`mailto:${config.privacyContactEmail}`}>
          {config.privacyContactEmail}
        </a>
        . You can ask for your contact record to be removed at any time.
      </p>
    </Section>

    <div className="mt-8 no-print">
      <Link to="/" className={secondaryButton}>
        Back
      </Link>
    </div>
  </Layout>
);
