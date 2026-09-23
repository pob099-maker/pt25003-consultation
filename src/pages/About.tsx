import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { PreferToTalk } from '../components/PreferToTalk';
import { ProgressOptOut } from '../components/ProgressOptOut';
import { card, primaryButton, secondaryButton } from '../components/ui';

const POINTS = [
  'Taking part is voluntary.',
  'You can skip any question you would rather not answer, and stop at any time.',
  'Your answers guide what the project works on, including research, demonstrations and extension.',
  'Results are reported as totals, not as individual answers.',
  'Contact details are optional. We only take them if you ask us to get in touch about something.',
  'Please leave out anything commercially sensitive unless you are comfortable putting it down.',
  'You do not have to do this online. You can give the same input over the phone or in person if you would rather.',
  'We record which step you reach, so we can tell whether a section is too long. It holds no answers and nothing you type, and you can switch it off below.',
] as const;

export const About = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const quick = params.get('quick') === '1';
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
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <ProgressOptOut />
      </section>

      <PreferToTalk />

      <p className="prose-measure mt-5 text-meta text-ink-soft">
        The full detail is in the{' '}
        <Link to="/privacy" className="underline underline-offset-4">
          privacy statement
        </Link>
        .
      </p>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Link to={quick ? '/consultation?quick=1' : '/consultation'} className={primaryButton}>
          Continue
        </Link>
        <button type="button" className={secondaryButton} onClick={() => navigate('/')}>
          Exit consultation
        </button>
      </div>
    </Layout>
  );
};
