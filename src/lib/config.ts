const read = (value: string | undefined, fallback: string): string => {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

export const config = {
  supabaseUrl: read(import.meta.env.VITE_SUPABASE_URL, ''),
  supabaseAnonKey: read(import.meta.env.VITE_SUPABASE_ANON_KEY, ''),
  homeUrl: read(import.meta.env.VITE_HOME_URL, 'https://potatolink.com.au'),
  privacyContactName: read(import.meta.env.VITE_PRIVACY_CONTACT_NAME, 'PotatoLink Project Team'),
  privacyContactEmail: read(import.meta.env.VITE_PRIVACY_CONTACT_EMAIL, 'info@potatolink.com.au'),
  /** Optional. Shown only when set, so the offer of a phone call is never made
   *  with no number behind it. */
  contactPhone: read(import.meta.env.VITE_CONTACT_PHONE, ''),
} as const;

/** False in a fresh checkout, and in tests, where the credentials are blanked. */
export const isBackendConfigured = (): boolean =>
  config.supabaseUrl.length > 0 && config.supabaseAnonKey.length > 0;
