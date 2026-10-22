import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// From 30 October 2026 Supabase no longer grants new tables to the Data API by
// itself, so a table without an explicit grant answers every request from the
// site with "permission denied". This keeps every table's grants in the
// migrations, where a rebuilt database will find them.
const DIR = 'supabase/migrations';
const sql = readdirSync(DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(`${DIR}/${name}`, 'utf8').replace(/--[^\n]*/g, ''))
  .join('\n');

const created = [...sql.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)].map((m) => m[1] ?? '');

/** Every grant statement as [the privileges, the tables it names, the roles it goes to]. */
const grants = [...sql.matchAll(/grant\s+([\w\s,]+?)\s+on\s+(?!function\b)([\w\s.,]+?)\s+to\s+([\w\s,]+?);/gi)].map((m) => ({
  privileges: (m[1] ?? '').toLowerCase(),
  tables: (m[2] ?? '').split(',').map((t) => t.trim().replace(/^public\./i, '').toLowerCase()),
  roles: (m[3] ?? '').split(',').map((r) => r.trim().toLowerCase()),
}));
const grantedTo = (table: string, role: string) => grants.some((g) => g.tables.includes(table) && g.roles.includes(role));

describe('table grants', () => {
  it('finds the tables', () => {
    expect(created.length).toBeGreaterThanOrEqual(12);
  });

  it.each(created)('%s is granted to the signed-in team and the server', (table) => {
    expect(grantedTo(table, 'authenticated')).toBe(true);
    expect(grantedTo(table, 'service_role')).toBe(true);
  });

  it('never lets a visitor read what people answered', () => {
    for (const table of ['consultation_responses', 'consultation_contacts', 'consultation_progress', 'consultation_text_tags']) {
      const visitor = grants.filter((g) => g.tables.includes(table) && g.roles.includes('anon'));
      expect(visitor.every((g) => !/\b(select|all)\b/.test(g.privileges))).toBe(true);
    }
  });
});
