import { Link } from 'react-router-dom';
import { accentPanel } from './ui';

const TOUR: readonly { to: string; title: string; what: string }[] = [
  {
    to: '/admin',
    title: 'Results dashboard',
    what: 'Priorities, ratings split from low to high, and who took part — filter by role, region, round or how the answers were collected.',
  },
  {
    to: '/admin?tab=change',
    title: 'Change over time',
    what: 'Baseline against the mid-project review, question by question. Any chart downloads as a picture for a report.',
  },
  {
    to: '/interview',
    title: 'Interview screen',
    what: 'A phone or face-to-face conversation guide: jump between topics, mark what came up unprompted, keep quotes, or run a five-minute short call.',
  },
  {
    to: '/workshop',
    title: 'Live workshop',
    what: 'The big-screen view for a field day: a QR code, live answers, bar charts and word clouds. To play the audience, open the join link in a second tab of this browser.',
  },
  {
    to: '/consultation',
    title: 'The online form',
    what: 'What a grower, contractor or processor sees — the questions change with their role.',
  },
];

/** A guided start for somebody we have sent the demonstration link to. */
export const DemoWelcome = () => (
  <section className={`${accentPanel} mt-6`} aria-labelledby="demo-welcome">
    <h2 id="demo-welcome" className="text-subtitle font-semibold">
      Welcome to the demonstration
    </h2>
    <p className="mt-2 text-body text-ink">
      This is the full consultation tool running on invented data: a baseline and a mid-project review, with responses
      collected online, by interview and in workshops. Nothing here is real, and nothing you enter is saved — click
      anything.
    </p>
    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
      {TOUR.map((stop) => (
        <li key={stop.to}>
          <Link to={stop.to} className="block h-full rounded-lg border border-line bg-surface p-4 hover:border-primary">
            <span className="block text-body font-semibold text-primary-ink">{stop.title} →</span>
            <span className="mt-1 block text-meta text-ink-soft">{stop.what}</span>
          </Link>
        </li>
      ))}
    </ul>
  </section>
);
