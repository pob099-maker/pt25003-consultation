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
    to: '/questions',
    title: 'Every question, on paper',
    what: 'The whole questionnaire as a document, marked with which questions the short version asks. Saves as a PDF through your browser.',
  },
  {
    to: '/',
    title: 'What a grower opens',
    what: 'The first page a respondent sees: a short version, a full one, and the offer to be rung instead. The questions change with their role.',
  },
];

/**
 * A guided start for somebody we have sent the demonstration link to.
 *
 * It sits on the results screen, because that is where the demonstration link
 * now lands: the people we send it to want to see what the tool produces, and
 * the respondent's view is one of the stops rather than the front door.
 *
 * `here` drops the stop you are already looking at.
 */
export const DemoWelcome = ({ here }: { here?: string }) => (
  <section className={`${accentPanel} mt-6`} aria-labelledby="demo-welcome">
    <h2 id="demo-welcome" className="text-subtitle font-semibold">
      Welcome to the demonstration
    </h2>
    <p className="mt-2 text-body text-ink">
      This is the full consultation tool running on invented data: a baseline and a mid-project review, with responses
      collected online, by interview and in workshops. Nothing here is real, and nothing you enter is saved — click
      anything.
    </p>
    <p className="mt-3 text-body text-ink">
      It works in three levels. The tool is the software; a <strong>project</strong> is a piece of work with its own
      questions, team and data, like this one or a regional program beside it; and a <strong>consultation</strong> is
      one period of asking inside a project, a baseline now and a review a year on. The picker at the top of the results
      screen moves between projects, and nothing crosses between them.
    </p>
    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
      {TOUR.filter((stop) => stop.to !== here).map((stop) => (
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
