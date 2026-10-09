import { z } from 'zod';
import { ROLES } from '../content/questionnaire';
import { LINK_CODE_ID, isLinkCode } from '../services/linkCode';

const roleIds = ROLES.map((role) => role.id) as [string, ...string[]];

/**
 * Free text is trimmed but never coerced. Note the absence of
 * `z.coerce.number()` anywhere: it turns an empty input into 0, which would
 * record "not a priority" for a question nobody answered.
 */
export const answerSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('multi'),
    values: z.array(z.string()).max(40),
    other: z.string().max(500).optional(),
    prompted: z.array(z.string()).max(40).optional(),
    // A question's own box. Listed here because an unlisted key is dropped
    // without a word, and the words would never reach the results.
    note: z.string().max(2000).optional(),
  }),
  z.object({ kind: z.literal('single'), value: z.string().min(1).max(120), note: z.string().max(300).optional() }),
  z.object({ kind: z.literal('text'), value: z.string().max(4000) }),
  z.object({
    kind: z.literal('rating'),
    // A scale's own steps, plus an answer beside them such as 6, tried it
    // and stopped. Which values a question offers is the question's business.
    values: z.record(z.string(), z.number().int().min(1).max(10)),
    other: z.string().max(500).optional(),
  }),
  z.object({ kind: z.literal('rank'), values: z.array(z.string()).max(5) }),
]);

export const consultationResponseSchema = z.object({
  id: z.string().uuid(),
  roundId: z.string().min(1).max(80),
  role: z.enum(roleIds).nullable(),
  pathway: z.string().max(40).nullable(),
  regions: z.array(z.string().max(60)).max(20),
  regionOther: z.string().max(200),
  answers: z.record(z.string(), answerSchema),
  startedAt: z.string().datetime(),
  submittedAt: z.string().datetime(),
  durationSeconds: z.number().int().min(0).max(60 * 60 * 24),
  isTestData: z.boolean(),
  method: z.enum(['online', 'interview_in_person', 'interview_video', 'interview_phone', 'workshop']),
  collectedBy: z.string().uuid().nullable(),
  consentVerbal: z.boolean().nullable(),
  sessionId: z.string().uuid().nullable(),
  source: z.string().max(40).nullable(),
})
  // An interview needs a spoken consent and a named interviewer. The database
  // checks this too; checking here as well gives the interviewer a readable
  // message instead of a constraint name.
  .refine(
    (response) =>
      !response.method.startsWith('interview_') || (response.consentVerbal === true && response.collectedBy !== null),
    { message: 'An interview needs the consent read aloud and agreed to before it can be saved.', path: ['consentVerbal'] },
  )
  // A workshop answer names its workshop; nothing else claims one.
  .refine((response) => (response.method === 'workshop') === (response.sessionId !== null), {
    message: 'A workshop response must name its workshop, and only a workshop response may.',
    path: ['sessionId'],
  })
  // The follow-up code only ever arrives in its one shape, because the form
  // builds it from three pieces. Anything else means something went wrong, and
  // a malformed code would quietly fail to link to anybody next time.
  .refine(
    (response) => {
      const code = response.answers[LINK_CODE_ID];
      return code === undefined || (code.kind === 'text' && isLinkCode(code.value));
    },
    { message: 'The follow-up code should be two letters, a day of the month and two letters.', path: ['answers'] },
  )
  // Anything marked as prompted has to have been mentioned at all.
  .refine(
    (response) =>
      Object.values(response.answers).every(
        (answer) => answer.kind !== 'multi' || (answer.prompted ?? []).every((id) => answer.values.includes(id)),
      ),
    { message: 'A prompted item must also be one of the items mentioned.', path: ['answers'] },
  );

/**
 * A contact record is only worth keeping if it says how to reach somebody. The
 * form and the stored record apply the same rule, so the form refuses it
 * before anything is sent, rather than the record refusing it after the
 * answers already have been.
 */
export const canBeReached = (details: { readonly email: string; readonly phone: string }): boolean =>
  details.email.trim().length > 0 || details.phone.trim().length > 0;

export const REACH_MESSAGE = 'Please give an email address or a phone number so we can reach you.';

/**
 * What to do with the last step, whether or not anything is ticked above the
 * contact boxes. Nothing ticked and nothing filled in is a plain "no thanks".
 * Anything ticked, or any box filled in, needs a way to reach them.
 */
export const contactDecision = (
  interests: readonly string[],
  values: ContactFormValues,
  noneId: string,
): 'skip' | 'needs-reach' | 'send' => {
  if (interests.includes(noneId)) return 'skip';
  const filledIn = [
    values.name,
    values.organisation,
    values.broadRole,
    values.region,
    values.email,
    values.phone,
    values.preferredContactTime,
    values.comments,
  ].some((value) => value.trim().length > 0);
  if (interests.length === 0 && !filledIn) return 'skip';
  return canBeReached(values) ? 'send' : 'needs-reach';
};

export const contactRecordSchema = z
  .object({
    id: z.string().uuid(),
    roundId: z.string().min(1).max(80),
    interests: z.array(z.string().max(60)).min(1).max(20),
    name: z.string().max(120),
    organisation: z.string().max(160),
    broadRole: z.string().max(120),
    region: z.string().max(120),
    email: z.union([z.string().email().max(200), z.literal('')]),
    phone: z.string().max(40),
    preferredContactMethod: z.string().max(20),
    preferredContactTime: z.string().max(160),
    comments: z.string().max(2000),
    submittedAt: z.string().datetime(),
    isTestData: z.boolean(),
    source: z.string().max(40).nullable(),
  })
  .refine((record) => canBeReached(record), {
    message: REACH_MESSAGE,
    path: ['email'],
  });

export type ConsultationResponseInput = z.infer<typeof consultationResponseSchema>;
export type ContactRecordInput = z.infer<typeof contactRecordSchema>;

/** Fields the optional contact form collects, before ids and timestamps. */
export const contactFormSchema = z.object({
  name: z.string().trim().max(120),
  organisation: z.string().trim().max(160),
  broadRole: z.string().trim().max(120),
  region: z.string().trim().max(120),
  email: z.union([z.string().trim().email('Please check the email address.').max(200), z.literal('')]),
  phone: z.string().trim().max(40),
  preferredContactMethod: z.enum(['email', 'phone', 'either']),
  preferredContactTime: z.string().trim().max(160),
  comments: z.string().trim().max(2000),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

/**
 * What somebody gives us when they ask to be rung instead of filling in a
 * form. Separate from the contact form because it demands different things:
 * a number is compulsory here, and a rough time to ring is the whole point.
 * Nothing else is asked, so the offer stays quick enough to accept.
 */
export const callbackRequestSchema = z.object({
  name: z.string().trim().min(1, 'Please tell us who to ask for.').max(120),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((value) => value.replace(/\D/g, '').length >= 8, 'Please give a number we can ring, including the area code.'),
  times: z.array(z.string().max(20)).min(1, 'Please tell us roughly when to ring.').max(8),
  note: z.string().trim().max(500),
});

export type CallbackRequestValues = z.infer<typeof callbackRequestSchema>;
