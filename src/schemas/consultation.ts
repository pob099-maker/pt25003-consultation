import { z } from 'zod';
import { ROLES } from '../content/questionnaire';

const roleIds = ROLES.map((role) => role.id) as [string, ...string[]];

/**
 * Free text is trimmed but never coerced. Note the absence of
 * `z.coerce.number()` anywhere: it turns an empty input into 0, which would
 * record "not a priority" for a question nobody answered.
 */
const answerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('multi'), values: z.array(z.string()).max(40), other: z.string().max(500).optional() }),
  z.object({ kind: z.literal('single'), value: z.string().min(1).max(120) }),
  z.object({ kind: z.literal('text'), value: z.string().max(4000) }),
  z.object({ kind: z.literal('rating'), values: z.record(z.string(), z.number().int().min(1).max(5)) }),
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
});

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
  })
  .refine((record) => record.email.trim().length > 0 || record.phone.trim().length > 0, {
    message: 'Please give an email address or a phone number so we can reach you.',
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
