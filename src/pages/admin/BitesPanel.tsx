import { useMemo, useState } from 'react';
import { accentPanel, card, secondaryButton, textInput } from '../../components/ui';
import { QrCode } from '../../components/QrCode';
import { useQuestionnaire } from '../../contexts/QuestionnaireContext';
import { currentProject, offersBites } from '../../content/projects';
import { optionLabel, questionById, roleLabel } from '../../content/lookup';
import { downloadCsv } from '../../lib/csv';
import { rankConstraints, rateAreas, tallyMulti } from '../../services/analysis';
import { biteLink, biteOf, biteSlots, biteTime, biteTitle, type Bite, type BiteSlot } from '../../services/bites';
import { responsesCsv } from '../../services/exportCsv';
import { SOURCES } from '../../services/sources';
import type { ConsultationResponse, Question, Questionnaire } from '../../types';

const percent = (share: number): string => `${Math.round(share * 100)}%`;

/** The source a QR code always carries, so a printed card is counted as one. */
const QR_SOURCE = 'qr';

/** What a split list shows, said plainly. Whole questions need nothing. */
const partNote = (questionnaire: Questionnaire, question: Question): string | null => {
  if (question.kind !== 'rating') return null;
  const whole = questionById(questionnaire, question.id);
  const total = whole?.kind === 'rating' ? whole.rows.length : question.rows.length;
  return question.rows.length < total ? `${question.rows.length} of its ${total} items` : null;
};

const Asks = ({ questionnaire, bite }: { questionnaire: Questionnaire; bite: Bite }) => (
  <ul className="mt-2 grid gap-1 pl-5 text-body text-ink list-disc">
    {bite.questions.map((question) => {
      const note = partNote(questionnaire, question);
      return (
        <li key={`${question.id}-${question.kind === 'rating' ? (question.rows[0]?.id ?? '') : ''}`}>
          {question.prompt}
          {note !== null && <span className="text-ink-soft"> ({note})</span>}
        </li>
      );
    })}
  </ul>
);

/** One question's bite answers, in the same measures the other tabs use. */
const Summary = ({
  frame,
  rows,
  question,
}: {
  frame: Questionnaire;
  rows: readonly ConsultationResponse[];
  question: Question;
}) => {
  const answered = rows.filter((row) => row.answers[question.id] !== undefined);
  const lines = ((): readonly string[] => {
    switch (question.kind) {
      case 'multi':
        return tallyMulti(frame, answered, question.id)
          .slice(0, 5)
          .map((tally) => `${tally.label}: ${tally.count} (${percent(tally.share)})`);
      case 'single': {
        const counts = new Map<string, number>();
        for (const row of answered) {
          const answer = row.answers[question.id];
          if (answer?.kind === 'single') counts.set(answer.value, (counts.get(answer.value) ?? 0) + 1);
        }
        return [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id, count]) => `${optionLabel(question, id)}: ${count} (${percent(count / Math.max(1, answered.length))})`);
      }
      case 'rank':
        return rankConstraints(frame, answered, question.id)
          .slice(0, 3)
          .map((ranked) => `${ranked.label}: ${ranked.firstChoices} first, score ${ranked.weightedScore}`);
      case 'rating': {
        const shown = new Set(question.rows.map((row) => row.id));
        return rateAreas(frame, answered, question.id)
          .filter((area) => shown.has(area.id) && area.responses > 0)
          .map((area) => `${area.label}: ${area.mean.toFixed(1)} from ${area.responses}`);
      }
      case 'text':
        return [];
    }
  })();
  return (
    <li>
      <p className="font-semibold text-ink">
        {question.prompt} <span className="font-normal text-ink-soft">· {answered.length} answered</span>
      </p>
      {lines.length > 0 && (
        <ul className="mt-1 grid gap-0.5 pl-4 text-meta text-ink-soft">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </li>
  );
};

const SlotCard = ({
  slot,
  questionnaire,
  frame,
  rows,
  channel,
}: {
  slot: BiteSlot;
  questionnaire: Questionnaire;
  frame: Questionnaire;
  rows: readonly ConsultationResponse[];
  channel: string;
}) => {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = biteLink(window.location.origin, slot.id, channel, import.meta.env.BASE_URL);
  const shared = slot.block !== 'pathway';
  const first = slot.asks[0]?.bite;
  const title = shared && first !== undefined ? biteTitle(first) : `Their own part of the industry, part ${slot.id.replace('pathway_', '')}`;
  const longest = Math.max(0, ...slot.asks.map((ask) => ask.bite.seconds));
  // Every question this link asks anybody, once each, in order.
  const questions = slot.asks
    .flatMap((ask) => ask.bite.questions)
    .filter((question, index, all) => all.findIndex((other) => other.id === question.id) === index);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className={card} aria-labelledby={`slot-${slot.id}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`slot-${slot.id}`} className="text-subtitle font-semibold">
          {title}
        </h3>
        <span className="text-meta font-semibold text-ink-soft">{biteTime(longest)}</span>
      </div>

      {shared && first !== undefined ? (
        <Asks questionnaire={questionnaire} bite={first} />
      ) : (
        <div className="mt-2 grid gap-3">
          {slot.asks.map((ask) => (
            <div key={ask.pathway ?? 'all'}>
              <p className="text-meta font-semibold text-ink">
                {ask.roles.map((role) => roleLabel(questionnaire, role)).join('; ')}
              </p>
              <p className="text-meta text-ink-soft">
                {biteTitle(ask.bite)}, {biteTime(ask.bite.seconds)}
              </p>
              <Asks questionnaire={questionnaire} bite={ask.bite} />
            </div>
          ))}
          {slot.nothingFor.length > 0 && (
            <p className="text-meta text-ink-soft">
              Nothing in this one for {slot.nothingFor.map((role) => roleLabel(questionnaire, role)).join('; ')}. The
              link tells them so and offers their next part instead.
            </p>
          )}
        </div>
      )}

      <p className="mt-3 text-body text-ink">
        <strong>{rows.length}</strong> {rows.length === 1 ? 'answer' : 'answers'} so far
      </p>

      <div className="mt-3">
        <code className="block select-all break-all rounded-md bg-sunk px-3 py-2 text-meta text-ink">{link}</code>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={secondaryButton} onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy the link'}
          </button>
          <button type="button" className={secondaryButton} aria-expanded={showQr} onClick={() => setShowQr((value) => !value)}>
            {showQr ? 'Hide the QR code' : 'QR code for a card'}
          </button>
        </div>
        {showQr && (
          <figure className="mt-3 w-48">
            <QrCode
              value={biteLink(window.location.origin, slot.id, QR_SOURCE, import.meta.env.BASE_URL)}
              label={`QR code for ${title}`}
              className="w-full"
            />
            <figcaption className="mt-1 text-meta text-ink-soft">Labelled as a QR code, whichever link is chosen above.</figcaption>
          </figure>
        )}
      </div>

      {rows.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-meta font-semibold text-primary-ink">What the answers say</summary>
          <ul className="mt-3 grid gap-3 text-body">
            {questions.map((question) => (
              <Summary key={question.id} frame={frame} rows={rows} question={question} />
            ))}
          </ul>
        </details>
      )}
    </article>
  );
};

/**
 * The short version a minute at a time: what each bite asks, its link for
 * each channel, and what has come back. See services/bites.ts.
 */
export const BitesPanel = ({ bites, frame }: { bites: readonly ConsultationResponse[]; frame: Questionnaire }) => {
  const questionnaire = useQuestionnaire();
  const open = offersBites(currentProject());
  const slots = useMemo(() => biteSlots(questionnaire), [questionnaire]);
  const [channel, setChannel] = useState('text');
  const bySlot = useMemo(() => {
    const groups = new Map<string, ConsultationResponse[]>();
    for (const row of bites) {
      const id = biteOf(row.answers);
      if (id === null) continue;
      groups.set(id, [...(groups.get(id) ?? []), row]);
    }
    return groups;
  }, [bites]);
  const others = useMemo(() => {
    const listed = new Set(slots.map((slot) => slot.id));
    return [...bySlot.entries()].filter(([id]) => !listed.has(id));
  }, [slots, bySlot]);
  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="mt-6 grid gap-5">
      <section className={accentPanel} aria-labelledby="bites-heading">
        <h2 id="bites-heading" className="text-subtitle font-semibold">
          Bites: the short version, a minute at a time
        </h2>
        <p className="mt-2 text-body text-ink">
          {open
            ? 'Bite links are open for this project.'
            : 'Bite links are closed for this project. Until they are turned on, a bite link shows a short "not open yet" page that points to the consultation.'}
        </p>
        <ul className="mt-3 grid gap-2 pl-5 text-body text-ink-soft list-disc">
          <li>
            Each bite is part of the short version for the person&rsquo;s own part of the industry: the same repeat
            questions, word for word, in the same order. One person&rsquo;s bites put together are their short version.
          </li>
          <li>
            Role and growing area are asked once on each phone. A link for &ldquo;their own part of the industry&rdquo;
            opens the growers&rsquo; questions for a grower and the contractors&rsquo; for a contractor, so one link can
            go to a whole chat group.
          </li>
          <li>
            Bite answers are kept off every other tab, because one person&rsquo;s bites are several rows. Read them here
            question by question, or count them in <strong>Change over time</strong>.
          </li>
        </ul>
      </section>

      <div className={card}>
        <label htmlFor="bite-channel-select" className="mb-1 block text-meta font-semibold text-ink-soft">
          Links below are labelled for
        </label>
        <select
          id="bite-channel-select"
          className={textInput}
          value={channel}
          onChange={(event) => setChannel(event.target.value)}
        >
          {SOURCES.map((source) => (
            <option key={source.id} value={source.id}>
              {source.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-meta text-ink-soft">
          One label per channel, never per person, as for every link. Send texts only to people who agreed to them.
        </p>
      </div>

      <section aria-labelledby="bite-list" className="grid gap-4">
        <h2 id="bite-list" className="text-subtitle font-semibold">
          The bites, in the order they go out
        </h2>
        {slots.map((slot) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            questionnaire={questionnaire}
            frame={frame}
            rows={bySlot.get(slot.id) ?? []}
            channel={channel}
          />
        ))}
      </section>

      {others.length > 0 && (
        <section className={card} aria-labelledby="other-bites">
          <h2 id="other-bites" className="text-subtitle font-semibold">
            Bites the live round does not ask
          </h2>
          <p className="mt-1 text-meta text-ink-soft">
            Answered in a round that asked them, such as what people saw and changed in a review. They are in the
            export and in Change over time like any other.
          </p>
          <ul className="mt-3 grid gap-1 text-body">
            {others.map(([id, rows]) => (
              <li key={id} className="flex justify-between gap-3">
                <span className="text-ink">{id}</span>
                <span className="text-ink-soft">
                  {rows.length} {rows.length === 1 ? 'answer' : 'answers'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div>
        <button
          type="button"
          className={secondaryButton}
          onClick={() => downloadCsv(`${currentProject().id.toLowerCase()}-bites-${stamp}.csv`, responsesCsv(frame, bites))}
        >
          Export bite answers (CSV)
        </button>
        <p className="mt-2 text-meta text-ink-soft">
          The same columns as the responses export, one row per bite. The short_or_full column names the bite.
        </p>
      </div>
    </div>
  );
};
