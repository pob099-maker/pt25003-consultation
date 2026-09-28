import { STORAGE_KEYS, readJson, removeKey, writeJson } from '../lib/storage';
import type { CollectionMethod, ConsultationResponse } from '../types';

/**
 * Where a response came from: the magazine, a newsletter, a link sent to one
 * grower, or passed on by somebody who had already taken part. It is how a
 * project learns which channels get traction, and it carries over to the next
 * project, which is most of its value.
 *
 * A channel, never a person. The codes are a fixed list, and anything else in
 * a link is recorded as 'other'. A link made up for one grower, say
 * ?src=direct-frank, would tie an anonymous set of answers to a name, and that
 * is the one thing this consultation promises never to do. Refusing unknown
 * codes enforces it in the code rather than leaving it to whoever writes the
 * next email.
 *
 * To add a source, add a line here and deploy. The dashboard lists the full
 * link for every entry, ready to paste.
 */

export type ChannelId = 'magazine' | 'newsletter' | 'direct' | 'shared' | 'other';

export interface SourceDefinition {
  /** What goes in the link: ?src=<id>. Lower case, no spaces. */
  readonly id: string;
  readonly channel: ChannelId;
  /** How the dashboard names it. */
  readonly label: string;
}

export const SOURCES: readonly SourceDefinition[] = [
  { id: 'mag22', channel: 'magazine', label: 'PotatoLink magazine, issue 22' },
  { id: 'bulletin', channel: 'newsletter', label: 'PotatoLink bulletin' },
  { id: 'direct', channel: 'direct', label: 'Sent direct to a grower' },
  { id: 'shared', channel: 'shared', label: 'Passed on by somebody who took part' },
];

/** Recorded for a link carrying a code that is not on the list above. */
export const OTHER_SOURCE = 'other';

/** What the thank-you page puts on the link it invites people to pass on. */
export const SHARED_SOURCE = 'shared';

export const CHANNEL_LABEL: Readonly<Record<ChannelId, string>> = {
  magazine: 'Magazines',
  newsletter: 'Newsletters and bulletins',
  direct: 'Sent direct to a grower',
  shared: 'Passed on by somebody who took part',
  other: 'A link we do not recognise',
};

/** Nobody arrived by a labelled link: they typed the address, or it came from somewhere unlabelled. */
export const UNLABELLED = 'No link label';

/**
 * How long a remembered link counts for. Somebody who opened the magazine link
 * in November and answers the mid-term review from a newsletter a year later
 * came in through the newsletter, whatever this browser remembers.
 */
const REMEMBER_DAYS = 30;

const definitionOf = (id: string | null): SourceDefinition | undefined =>
  id === null ? undefined : SOURCES.find((source) => source.id === id);

/**
 * The source named in a page address, reduced to a code from the list,
 * 'other', or null when there is none. Reads the ordinary query string and a
 * query inside the hash, because a link can be written either way.
 */
export const sourceFromAddress = (search: string, hash: string): string | null => {
  const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?')) : '';
  const raw = new URLSearchParams(search).get('src') ?? new URLSearchParams(hashQuery).get('src');
  if (raw === null) return null;
  const code = raw.trim().toLowerCase();
  if (code.length === 0) return null;
  return definitionOf(code) === undefined ? OTHER_SOURCE : code;
};

interface Remembered {
  readonly source: string;
  readonly at: string;
}

/**
 * Notes the link somebody arrived by, once per visit, before anything else
 * runs. The first labelled link wins: it is what brought them in, and a later
 * visit that typed the address must not wipe it out. A remembered link older
 * than REMEMBER_DAYS is forgotten rather than credited.
 */
export const rememberArrival = (now: Date = new Date()): void => {
  const found = sourceFromAddress(window.location.search, window.location.hash);
  if (found === null) return;
  if (arrivalSource(now) !== null) return;
  writeJson(STORAGE_KEYS.arrival, { source: found, at: now.toISOString() } satisfies Remembered);
};

/** The link this browser arrived by, if it is recent enough to count. */
export const arrivalSource = (now: Date = new Date()): string | null => {
  const remembered = readJson<Remembered>(STORAGE_KEYS.arrival);
  if (remembered === null || typeof remembered.source !== 'string') return null;
  const age = now.getTime() - new Date(remembered.at).getTime();
  if (!(age >= 0 && age <= REMEMBER_DAYS * 24 * 60 * 60 * 1000)) return null;
  return remembered.source;
};

/** After a response is sent, so the next person on the same phone starts clean. */
export const forgetArrival = (): void => removeKey(STORAGE_KEYS.arrival);

export const sourceLabel = (source: string | null): string => {
  if (source === null) return UNLABELLED;
  return definitionOf(source)?.label ?? CHANNEL_LABEL.other;
};

export const channelOf = (source: string | null): ChannelId | null => {
  if (source === null) return null;
  return definitionOf(source)?.channel ?? 'other';
};

/** The full link to paste, for a source on the list. */
export const linkFor = (origin: string, id: string): string => `${origin}/?src=${id}`;

const METHOD_ROUTE: Readonly<Record<Exclude<CollectionMethod, 'online'>, string>> = {
  interview_in_person: 'Interviews, in person',
  interview_video: 'Interviews, by video',
  interview_phone: 'Interviews, by phone',
  workshop: 'Workshops',
};

export interface RouteRow {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  /** The individual links behind a channel, when there is more than one. */
  readonly parts: readonly { readonly label: string; readonly count: number }[];
}

/**
 * How the responses arrived, largest first. An online answer is credited to
 * the channel of the link it came in on; an interview or a workshop never had
 * a link, so it is credited to the way it was collected, which keeps the
 * picture whole.
 */
export const tallyRoutes = (responses: readonly ConsultationResponse[]): readonly RouteRow[] => {
  const groups = new Map<string, { label: string; count: number; parts: Map<string, number> }>();
  const add = (key: string, label: string, part: string): void => {
    const group = groups.get(key) ?? { label, count: 0, parts: new Map<string, number>() };
    group.count += 1;
    group.parts.set(part, (group.parts.get(part) ?? 0) + 1);
    groups.set(key, group);
  };

  for (const response of responses) {
    if (response.method !== 'online') {
      const label = METHOD_ROUTE[response.method];
      add(response.method, label, label);
      continue;
    }
    const channel = channelOf(response.source);
    if (channel === null) add('unlabelled', UNLABELLED, UNLABELLED);
    else add(channel, CHANNEL_LABEL[channel], sourceLabel(response.source));
  }

  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      label: group.label,
      count: group.count,
      parts:
        group.parts.size > 1
          ? [...group.parts.entries()]
              .map(([label, count]) => ({ label, count }))
              .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
          : [],
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
};
