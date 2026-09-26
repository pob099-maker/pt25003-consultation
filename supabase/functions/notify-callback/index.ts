/**
 * Emails the project team when somebody asks to be rung.
 *
 * A request for a call has a clock on it: an expression of interest keeps for
 * a month, a callback goes stale in days. Nobody is going to keep the Contacts
 * tab open, so the tab has to come to them.
 *
 * It runs as a Supabase Edge Function, called by a database webhook on insert
 * into consultation_contacts. Deliberately dumb and one-way: it reads the row
 * out of the webhook payload, so it needs no database credentials of its own,
 * and it never writes anything. A failure here cannot lose a request — the row
 * is already committed before the webhook fires, and it is sitting in the
 * Contacts tab whatever this does.
 *
 * Set up in docs/SETUP.md, section 8.
 */

// Kept in step with src/services/callback.ts by hand, because a Deno function
// cannot import from src/ without dragging zod and the questionnaire in with
// it. src/services/callback.test.ts reads this file and fails if the two ever
// disagree, which is the failure that would otherwise be silent: every insert
// stops matching, the log says 200, and the emails just stop.
const CALLBACK_INTEREST_ID = 'callback';
const CONTACTS_TABLE = 'consultation_contacts';

/** Longest a field may be before it is cut, per field. */
const FIELD_LIMIT = 300;

interface ContactRow {
  readonly id?: string;
  readonly project_id?: string;
  readonly round_id?: string;
  readonly interests?: readonly string[];
  readonly name?: string;
  readonly phone?: string;
  readonly preferred_contact_time?: string;
  readonly comments?: string;
  readonly submitted_at?: string;
  readonly is_test_data?: boolean;
}

interface WebhookPayload {
  readonly type?: string;
  readonly table?: string;
  readonly record?: ContactRow;
}

const env = (name: string): string => Deno.env.get(name)?.trim() ?? '';

/**
 * Anything out of the row is written by whoever filled the form in, and an
 * anonymous caller can insert one straight into the table, so none of it is
 * trusted here. Control characters go (a newline in a name would otherwise
 * forge the layout of this email, which the team is being asked to act on),
 * and length is capped so a megabyte of text cannot be posted through.
 */
const printable = (character: string): string => {
  const code = character.codePointAt(0) ?? 32;
  return code < 32 || code === 127 ? ' ' : character;
};

const safe = (value: string | undefined): string =>
  [...(value ?? '')]
    .map(printable)
    .join('')
    .trim()
    .slice(0, FIELD_LIMIT);

/** 200 with a reason: a webhook that is told "not for you" should not retry. */
const ok = (reason: string): Response => new Response(JSON.stringify({ ok: true, reason }), { status: 200 });

const body = (record: ContactRow, adminUrl: string): string => {
  // Labelled fields first, and the name inside one of them: text somebody else
  // typed never leads this email, so it cannot be mistaken for the project
  // speaking.
  const lines = [
    'Somebody has asked us to ring them.',
    '',
    `Name:       ${safe(record.name) || 'not given'}`,
    `Phone:      ${safe(record.phone) || 'not given'}`,
    `Best time:  ${safe(record.preferred_contact_time) || 'not given'}`,
  ];
  if (safe(record.comments)) lines.push(`They said:  ${safe(record.comments)}`);
  lines.push('', `Project:    ${safe(record.project_id) || 'unknown'}`, `Asked at:   ${safe(record.submitted_at) || 'unknown'}`);
  if (adminUrl.length > 0) lines.push('', `The Contacts tab: ${adminUrl}`);
  lines.push(
    '',
    'Ring inside a day or two, and take their answers on the phone screen.',
    'Their details are in the Contacts tab as well; this email is a nudge, not the record.',
  );
  return lines.join('\n');
};

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // The function is deployed without JWT verification so the webhook can be a
  // plain HTTP call, which leaves this shared secret as the only thing keeping
  // strangers from posting invented callbacks into somebody's inbox.
  const secret = env('NOTIFY_SECRET');
  if (secret.length === 0) return new Response('Not configured', { status: 500 });
  if (request.headers.get('x-callback-secret') !== secret) return new Response('Forbidden', { status: 403 });

  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const record = payload.record;
  if (payload.type !== 'INSERT' || record === undefined) return ok('not an insert');
  // A second webhook pointed at this URL would otherwise have its rows emailed
  // as call-backs.
  if (payload.table !== CONTACTS_TABLE) return ok('not the contacts table');
  if (!(record.interests ?? []).includes(CALLBACK_INTEREST_ID)) return ok('not a callback request');
  if (record.is_test_data === true) return ok('test data');

  const apiKey = env('RESEND_API_KEY');
  const to = env('NOTIFY_TO');
  const from = env('NOTIFY_FROM');
  if (apiKey.length === 0 || to.length === 0 || from.length === 0) return new Response('Not configured', { status: 500 });

  const who = safe(record.name) || 'Somebody';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      // Several addresses may be set, separated by commas, so the roster is a
      // setting rather than a deploy.
      to: to.split(',').map((address) => address.trim()).filter((address) => address.length > 0),
      subject: `Call back: ${who}${safe(record.phone) ? ` on ${safe(record.phone)}` : ''}`.slice(0, 200),
      text: body(record, env('NOTIFY_ADMIN_URL')),
    }),
  });

  if (!response.ok) {
    // Worth a 500: the dashboard's webhook log is where anybody looks when the
    // emails stop, and a quiet 200 would say everything was fine.
    const detail = await response.text();
    console.error('Resend refused the message', response.status, detail);
    return new Response('Email provider refused the message', { status: 500 });
  }

  return ok('sent');
});
