import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { applyStoredTheme } from './components/ThemeToggle';
import { getSupabase } from './lib/supabase';
import { isDemoSite } from './lib/config';

// Before the first render, so a reader who chose dark never sees a flash of cream.
applyStoredTheme();

// The demonstration site is for people we send it to, not for search results.
if (isDemoSite()) {
  const robots = document.createElement('meta');
  robots.name = 'robots';
  robots.content = 'noindex, nofollow';
  document.head.appendChild(robots);
  document.title = `Demo · ${document.title}`;
}

/**
 * Supabase's standard invitation and reset emails return people with their
 * one-time token after a `#` — the same place this app keeps its page routes.
 * Left alone, the router reads "#access_token=…" as a page that does not exist,
 * sends them to the landing page, and the token is gone.
 *
 * So when the address carries one, the auth client reads it first, and only
 * then is the address rewritten to the page that belongs to it. The emails the
 * project sends are set up not to do this at all (see docs/TEAM-LOGINS.md);
 * this keeps the default emails working too, rather than failing silently.
 */
const claimAuthRedirect = async (): Promise<void> => {
  const hash = window.location.hash;
  if (!/(^#|&)(access_token|error_description)=/.test(hash)) return;
  const params = new URLSearchParams(hash.slice(1));
  const type = params.get('type');
  const supabase = getSupabase();
  if (supabase !== null) {
    // Creating the client makes it read and store the session from the URL.
    await Promise.race([supabase.auth.getSession(), new Promise((resolve) => setTimeout(resolve, 4000))]);
  }
  const target = type === 'invite' || type === 'recovery' ? '#/set-password' : '#/admin';
  window.history.replaceState(null, '', `${window.location.pathname}${target}`);
};

const mount = (): void => {
  const container = document.getElementById('root');
  if (container === null) return;
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

// Mounts whatever happens: a failed token read must never become a blank page.
void claimAuthRedirect().finally(mount);
