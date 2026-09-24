import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // GitHub Pages serves a project site from /<repo>/, so the asset paths have
  // to be built for wherever the app will actually live. Any host that serves
  // from the root needs nothing set.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    // Tests must never reach a real backend. Vite loads .env files into the
    // test process, so a developer with .env.local present would otherwise
    // have `npm test` writing rows into a live Supabase project.
    // The contacts too, for a different reason: a test that renders the
    // landing page should describe the shipped default, not whoever happens to
    // be listed in the developer's .env.local.
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_PROJECT_CONTACTS: '' },
  },
});
