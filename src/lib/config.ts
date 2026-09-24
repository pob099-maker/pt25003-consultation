const read = (value: string | undefined, fallback: string): string => {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

export interface ProjectContact {
  readonly name: string;
  readonly phone: string;
  readonly email: string;
}

/**
 * Who a respondent would be talking to if a form does not suit them.
 *
 * Set as `Name|Phone|Email`, several separated by a semicolon, so a second or
 * third person is an environment change rather than a code change. Phone and
 * email are both optional, and a name on its own is the normal case now: the
 * call-back form is how somebody asks to be rung, so publishing a mobile is a
 * choice rather than the only way in. A name still earns its place, because
 * "somebody will ring you" and "Peter or Steph will ring you" are different
 * promises.
 */
export const parseContacts = (raw: string): readonly ProjectContact[] =>
  raw
    .split(';')
    .map((entry) => entry.split('|').map((part) => part.trim()))
    .map((parts) => ({ name: parts[0] ?? '', phone: parts[1] ?? '', email: parts[2] ?? '' }))
    .filter((contact) => contact.name.length > 0);

/** "Peter O'Brien", or "Peter O'Brien or Steph Tabone", for a sentence. */
export const contactNames = (contacts: readonly ProjectContact[]): string => {
  const names = contacts.map((contact) => contact.name);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0] as string;
  return `${names.slice(0, -1).join(', ')} or ${names.at(-1) as string}`;
};

const DEFAULT_CONTACTS = "Peter O'Brien;Steph Tabone";

export const config = {
  /** Which project this deployment serves. One database can hold several. */
  projectId: read(import.meta.env.VITE_PROJECT_ID, 'PT25003'),
  supabaseUrl: read(import.meta.env.VITE_SUPABASE_URL, ''),
  supabaseAnonKey: read(import.meta.env.VITE_SUPABASE_ANON_KEY, ''),
  homeUrl: read(import.meta.env.VITE_HOME_URL, 'https://potatolink.com.au'),
  privacyContactName: read(import.meta.env.VITE_PRIVACY_CONTACT_NAME, 'PotatoLink Project Team'),
  privacyContactEmail: read(import.meta.env.VITE_PRIVACY_CONTACT_EMAIL, 'info@potatolink.com.au'),
  projectContacts: parseContacts(read(import.meta.env.VITE_PROJECT_CONTACTS, DEFAULT_CONTACTS)),
} as const;

/**
 * The public demonstration build (served at /demo/). It runs on invented data
 * and never talks to a database — even if credentials were somehow present,
 * this switch alone keeps it off, so a demo can never write to the real one.
 */
export const isDemoSite = (): boolean => import.meta.env.VITE_DEMO === 'true';

/** False in a fresh checkout, in tests where the credentials are blanked, and always on the demo site. */
export const isBackendConfigured = (): boolean =>
  !isDemoSite() && config.supabaseUrl.length > 0 && config.supabaseAnonKey.length > 0;

/** Digits only, so a mobile number with spaces still dials from a phone. */
export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;
