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
 * Who somebody can ring if an online form does not suit them.
 *
 * Set as `Name|Phone|Email`, several separated by a semicolon, so a second or
 * third contact can be added by changing an environment variable rather than
 * the code. Phone and email are each optional within an entry; an entry with
 * neither is dropped, because a name with no way to reach it is worse than no
 * offer at all.
 */
export const parseContacts = (raw: string): readonly ProjectContact[] =>
  raw
    .split(';')
    .map((entry) => entry.split('|').map((part) => part.trim()))
    .map((parts) => ({ name: parts[0] ?? '', phone: parts[1] ?? '', email: parts[2] ?? '' }))
    .filter((contact) => contact.name.length > 0 && (contact.phone.length > 0 || contact.email.length > 0));

const DEFAULT_CONTACTS = "Peter O'Brien|0409 773 111|";

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
