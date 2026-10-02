import { describe, expect, it } from 'vitest';
import { DEFAULT_QUESTIONNAIRE } from './questionnaire';
import { PROJECTS } from './projects';
import { scoreboardSettingsFor } from './scoreboardSettings';

const coverage = scoreboardSettingsFor(PROJECTS.PT25003 as NonNullable<typeof PROJECTS.PT25003>).coverage;
const NOT_A_PLACE = new Set(['national', 'other', 'no_say']);
const areas = DEFAULT_QUESTIONNAIRE.regions.filter((option) => !NOT_A_PLACE.has(option.id));

describe('areas and regions', () => {
  it('puts every growing area in exactly one region', () => {
    for (const area of areas) {
      const regions = coverage.filter((region) => region.from.includes(area.id)).map((region) => region.id);
      expect(regions, area.label).toHaveLength(1);
    }
  });

  it('builds regions only from areas the consultation asks about', () => {
    const asked = new Set(areas.map((area) => area.id));
    for (const region of coverage) for (const id of region.from) expect(asked.has(id), `${region.id}: ${id}`).toBe(true);
  });

  it('names the towns in every area, so a grower near a border can find their own', () => {
    for (const area of areas) expect(area.help, area.label).toMatch(/\w/);
    const riverina = areas.find((area) => area.id === 'riverina');
    expect(riverina?.help).toContain('Holbrook');
    expect(riverina?.help).toContain('Victorian side of the Murray');
  });

  it('keeps the seven regions the WhatsApp link labels are named after', () => {
    expect(coverage.map((region) => region.id).sort()).toEqual(['ballarat', 'gippsland', 'nsw', 'qld', 'sa', 'tas', 'wa']);
  });
});
