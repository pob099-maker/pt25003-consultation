import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScoreboardView } from '../components/ScoreboardView';
import { currentProject } from '../content/projects';
import { scoreboardSettingsFor } from '../content/scoreboardSettings';
import { MOTTO, loadPublished, monthLabel, type Edition } from '../services/scoreboard';
import { secondaryButton } from '../components/ui';

/**
 * The public scoreboard. It reads published editions and nothing else; the
 * database refuses anything more to a visitor.
 *
 *   #/scoreboard                    the latest monthly update
 *   #/scoreboard/2026-10            that month's update
 *   #/scoreboard/2026-12/annual     that year's playback
 *   #/scoreboard/2026-10/tas        a region's page, where regional pages are on
 *
 * Add ?embed=1 to drop the site's own header and footer, for a page that sits
 * inside another website.
 */

const Frame = ({ embed, children }: { embed: boolean; children: ReactNode }) =>
  embed ? (
    <main id="main" className="min-h-dvh bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-5xl">{children}</div>
    </main>
  ) : (
    <Layout>{children}</Layout>
  );

export const Scoreboard = () => {
  const { period, part } = useParams();
  const [params] = useSearchParams();
  const embed = params.get('embed') === '1';
  const project = currentProject();
  const settings = scoreboardSettingsFor(project);
  const [editions, setEditions] = useState<readonly Edition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    document.title = `${MOTTO} · ${project.shortName}`;
  }, [project.shortName]);

  useEffect(() => {
    let cancelled = false;
    void loadPublished().then((result) => {
      if (cancelled) return;
      if (result.success) {
        setEditions(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const kind = part === 'annual' ? 'annual' : 'monthly';
  const scope = part !== undefined && part !== 'annual' ? part : 'national';
  const shown = useMemo(() => {
    if (editions === null) return null;
    const candidates = editions.filter((edition) => edition.kind === kind && edition.scope === scope);
    return (period === undefined ? candidates[0] : candidates.find((edition) => edition.period === period)) ?? null;
  }, [editions, kind, period, scope]);

  const base = embed ? '?embed=1' : '';
  const regionName = (id: string): string => settings.coverage.find((region) => region.id === id)?.name ?? id;

  if (error !== null) {
    return (
      <Frame embed={embed}>
        <p className="text-body">The scoreboard could not be loaded just now.</p>
        <button type="button" className={`${secondaryButton} mt-4`} onClick={() => setNonce((value) => value + 1)}>
          Try again
        </button>
      </Frame>
    );
  }

  if (editions === null) {
    return (
      <Frame embed={embed}>
        <p className="text-ink-soft">Loading the scoreboard…</p>
      </Frame>
    );
  }

  if (shown === null || shown.content.snapshot === null) {
    return (
      <Frame embed={embed}>
        <h1>
          You said. We heard. <span className="text-primary-ink">We&rsquo;re acting.</span>
        </h1>
        <p className="mt-4 text-body text-ink-soft">
          {editions.length === 0
            ? `The first update for the ${project.name} has not been published yet.`
            : 'There is no update for that month.'}
        </p>
        {editions.length > 0 && (
          <p className="mt-4">
            <Link to={`/scoreboard${base}`} className="font-semibold text-primary-ink underline underline-offset-4">
              See the latest update
            </Link>
          </p>
        )}
      </Frame>
    );
  }

  const sameMonthScopes = editions.filter((edition) => edition.kind === 'monthly' && edition.period === shown.period);
  const archive = editions.filter((edition) => edition.scope === 'national');

  return (
    <Frame embed={embed}>
      <div className="grid gap-8">
        {settings.regionalPages && sameMonthScopes.length > 1 && (
          <nav className="flex flex-wrap gap-2" aria-label="View by region">
            {sameMonthScopes.map((edition) => (
              <Link
                key={edition.id}
                to={`/scoreboard/${edition.period}${edition.scope === 'national' ? '' : `/${edition.scope}`}${base}`}
                aria-current={edition.id === shown.id ? 'page' : undefined}
                className={`rounded-full border px-3 py-1 text-meta font-semibold ${
                  edition.id === shown.id ? 'border-primary bg-primary text-white' : 'border-line-strong text-ink-soft'
                }`}
              >
                {edition.scope === 'national' ? 'National' : regionName(edition.scope)}
              </Link>
            ))}
          </nav>
        )}
        <ScoreboardView
          edition={shown}
          numbers={shown.content.snapshot.participation}
          items={shown.content.snapshot.items}
          settings={settings}
          projectName={project.name}
          projectReference={project.reference}
          scopeName={shown.scope === 'national' ? undefined : regionName(shown.scope)}
        />
        {archive.length > 1 && (
          <nav aria-label="Earlier updates" className="border-t border-line pt-4">
            <h2 className="text-eyebrow font-bold uppercase tracking-wide text-ink-soft">Earlier updates</h2>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-meta">
              {archive.map((edition) => (
                <li key={edition.id}>
                  <Link
                    to={`/scoreboard/${edition.period}${edition.kind === 'annual' ? '/annual' : ''}${base}`}
                    aria-current={edition.id === shown.id ? 'page' : undefined}
                    className={edition.id === shown.id ? 'font-semibold text-ink' : 'text-primary-ink underline underline-offset-4'}
                  >
                    {edition.kind === 'annual' ? `${edition.period.slice(0, 4)} playback` : monthLabel(edition.period)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </Frame>
  );
};
