import type { ContactRecord, Option } from '../types';
import type { CallbackRequestValues } from '../schemas/consultation';

/**
 * A request to be rung back, rather than a form filled in.
 *
 * It is stored as an ordinary contact record so it travels with everything
 * already built for those: the same table and row-level policy, the same
 * offline outbox, the same admin list and the same CSV export. What marks it
 * out is the interest id, which is also why a request cannot be joined back
 * onto any set of answers: contact records never are.
 */
export const CALLBACK_INTEREST_ID = 'callback';

export const CALLBACK_INTEREST_LABEL = 'Asked us to ring them';

export const ANY_TIME_ID = 'any';

/**
 * Roughly when to ring, in the words somebody would use on the phone.
 *
 * Deliberately vague about clock time. A grower halfway down a paddock cannot
 * promise to be free at 10:15, and a window somebody can actually keep is
 * worth more to whoever is dialling than a precise one they cannot.
 *
 * No commas inside a label: two of these are read back as one comma-separated
 * line, on the confirmation and again on the contact list, and a label with a
 * comma in it turns that line into a run-on nobody can parse.
 */
export const CALL_TIMES: readonly Option[] = [
  { id: 'early', label: 'Early morning (before 8)' },
  { id: 'morning', label: 'Morning' },
  { id: 'midday', label: 'Middle of the day' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening (after 6)' },
  { id: ANY_TIME_ID, label: 'Any time suits' },
];

/**
 * Ticking a window, with "any time" exclusive: holding it alongside three
 * named windows would leave whoever rings unable to tell which the person
 * meant.
 */
export const nextTimes = (current: readonly string[], id: string): readonly string[] => {
  if (id === ANY_TIME_ID) return current.includes(ANY_TIME_ID) ? [] : [ANY_TIME_ID];
  const withoutAny = current.filter((value) => value !== ANY_TIME_ID);
  return withoutAny.includes(id) ? withoutAny.filter((value) => value !== id) : [...withoutAny, id];
};

/**
 * The windows as one line of text, always in day order rather than the order
 * they were tapped, so "morning, afternoon" never arrives backwards on the
 * list somebody is working through.
 */
export const callTimeSummary = (ids: readonly string[]): string =>
  CALL_TIMES.filter((time) => ids.includes(time.id))
    .map((time) => time.label)
    .join(', ');

export const isCallbackRequest = (contact: ContactRecord): boolean =>
  contact.interests.includes(CALLBACK_INTEREST_ID);

/**
 * Only a name, a number and a window are asked for. Organisation, role and
 * region are left empty on purpose: whoever rings can ask, and every extra
 * field on this form is another reason to give up and not ring at all.
 */
export const toCallbackRecord = (
  values: CallbackRequestValues,
  roundId: string,
  now: Date = new Date(),
): ContactRecord => ({
  id: crypto.randomUUID(),
  roundId,
  interests: [CALLBACK_INTEREST_ID],
  name: values.name,
  organisation: '',
  broadRole: '',
  region: '',
  email: '',
  phone: values.phone,
  preferredContactMethod: 'phone',
  preferredContactTime: callTimeSummary(values.times),
  comments: values.note,
  submittedAt: now.toISOString(),
  isTestData: false,
});
