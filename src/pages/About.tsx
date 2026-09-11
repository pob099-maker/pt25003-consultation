import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { card, primaryButton, secondaryButton } from '../components/ui';

const POINTS = [
  'Taking part is voluntary.',
  'You can skip any question you would rather not answer, and stop at any time.',
  'Your answers will be used to guide the research, demonstration and extension priorities of the Potato Mechanisation Project.',
  'Results will be summarised in aggregate form.',
  'Contact details are optional. They are only collected if you ask to be contacted or express interest in follow-up activities.',
  'Please do not enter commercially confidential information unless you are comfortable doing so.',
] as const;

export const About = () => {
  const navigate = useNavigate();
  return (
    <Layout>
      <h1 className="prose-measure">Before you start</h1>
      <section className={`${card} mt-6 prose-measure`} aria-labelledby="what-to-know">
        <h2 id="what-to-know" className="text-subtitle font-semibold">
          What you should know
        </h2>
        <ul className="mt-3 space-y-3 text-ink-soft">
          {POINTS.map((point) => (
            <li key={point} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="prose-measure mt-5 text-meta text-ink-soft">
        The full detail is in the <Link to="/privacy" className="underline underline-offset-4">privacy statement</Link>.
      </p>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Link to="/consultation" className={primaryButton}>
          Continue
        </Link>
        <button type="button" className={secondaryButton} onClick={() => navigate('/')}>
          Exit consultation
        </button>
      </div>
    </Layout>
  );
};
