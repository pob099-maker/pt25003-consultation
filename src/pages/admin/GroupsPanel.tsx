import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { accentPanel, card, primaryButton, secondaryButton } from '../../components/ui';
import { useQuestionnaire } from '../../contexts/QuestionnaireContext';
import { questionById } from '../../content/lookup';
import { downloadCsv } from '../../lib/csv';
import { deleteGroup, groupsCsv, loadGroups, summariseGroups, type GroupRecord } from '../../services/groups';

const percent = (share: number): string => `${Math.round(share * 100)}%`;

/** The questions most worth seeing at a glance across rooms. */
const HEADLINE = ['q1_constraints', 'q2_top_three', 'q_trial'] as const;

/**
 * Group discussions, kept apart from individual responses on purpose. The
 * totals here say "7 of the 25 people in the rooms that were asked", never
 * "7 responses".
 */
export const GroupsPanel = ({ roundFilter }: { roundFilter: string }) => {
  const questionnaire = useQuestionnaire();
  const [records, setRecords] = useState<readonly GroupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRecords(await loadGroups());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(
    () => records.filter((record) => roundFilter === 'all' || record.roundId === roundFilter),
    [records, roundFilter],
  );

  const people = shown.reduce((sum, record) => sum + record.present, 0);

  const remove = async (record: GroupRecord): Promise<void> => {
    if (!window.confirm(`Delete the record of "${record.title}" on ${record.heldOn}? This cannot be undone.`)) return;
    const result = await deleteGroup(record.id);
    setMessage(result.success ? 'Deleted.' : result.error);
    await load();
  };

  return (
    <div className="mt-6 grid gap-5">
      <section className={accentPanel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-subtitle font-semibold">Group discussions</h2>
            <p className="mt-1 text-meta text-ink-soft">
              {shown.length === 0
                ? 'None recorded in this round yet.'
                : `${shown.length} ${shown.length === 1 ? 'group' : 'groups'}, about ${people} people in total.`}{' '}
              Kept separate from individual responses — a show of hands is not a set of responses.
            </p>
          </div>
          <Link to="/group" className={primaryButton}>
            Record a group discussion
          </Link>
        </div>
      </section>

      {message !== null && (
        <p className={`${card} text-body`} role="status">
          {message}
        </p>
      )}

      {loading && <p className="text-ink-soft">Loading…</p>}

      {!loading && shown.length > 0 && (
        <>
          <div className="grid gap-5 md:grid-cols-3">
            {HEADLINE.map((questionId) => {
              const summary = summariseGroups(questionnaire, shown, questionId);
              const question = questionById(questionnaire, questionId);
              return (
                <section key={questionId} className={card}>
                  <h3 className="text-body font-semibold text-ink">{question?.guide?.open ?? question?.prompt}</h3>
                  <p className="mt-1 text-meta text-ink-soft">
                    {summary.groups === 0
                      ? 'Not asked in any group yet.'
                      : `${summary.groups} ${summary.groups === 1 ? 'group' : 'groups'}, ${summary.people} people asked.`}
                  </p>
                  <ul className="mt-3 grid gap-1 text-meta">
                    {summary.rows
                      .filter((row) => row.hands > 0)
                      .slice(0, 6)
                      .map((row) => (
                        <li key={row.id} className="flex justify-between gap-3">
                          <span className="text-ink">{row.label}</span>
                          <span className="shrink-0 text-ink-soft">
                            {row.hands} · {percent(row.share)}
                          </span>
                        </li>
                      ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <section className={card}>
            <h3 className="text-subtitle font-semibold">Recorded groups</h3>
            <ul className="mt-3 grid gap-2">
              {shown.map((record) => (
                <li
                  key={record.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2 last:border-0"
                >
                  <span>
                    <span className="block text-body text-ink">{record.title}</span>
                    <span className="block text-meta text-ink-faint">
                      {record.heldOn}
                      {record.region.length > 0 ? ` · ${record.region}` : ''} · {record.present} present ·{' '}
                      {Object.keys(record.counts).length} questions counted
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <Link to={`/group/${record.id}`} className={secondaryButton}>
                      Edit
                    </Link>
                    <button type="button" className={secondaryButton} onClick={() => void remove(record)}>
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <div>
            <button
              type="button"
              className={secondaryButton}
              onClick={() =>
                downloadCsv(
                  `pt25003-groups-${new Date().toISOString().slice(0, 10)}.csv`,
                  groupsCsv(questionnaire, shown),
                )
              }
            >
              Export group discussions (CSV)
            </button>
          </div>
        </>
      )}
    </div>
  );
};
