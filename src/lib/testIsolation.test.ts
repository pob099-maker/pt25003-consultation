import { describe, expect, it } from 'vitest';
import { isBackendConfigured } from './config';
import { getSupabase } from './supabase';

/**
 * Vitest loads .env files through Vite, so a developer with .env.local present
 * would otherwise have the test run writing rows into a live Supabase project.
 * vite.config.ts blanks the credentials for tests; this fails if that stops
 * being true. Do not work around it by re-supplying them.
 */
describe('test isolation', () => {
  it('has no backend credentials during a test run', () => {
    expect(isBackendConfigured()).toBe(false);
    expect(getSupabase()).toBeNull();
  });
});
