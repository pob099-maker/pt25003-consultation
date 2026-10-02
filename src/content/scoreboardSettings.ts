import type { ProjectDefinition } from './projects';

/**
 * A region the scoreboard reports coverage for. It is built from the
 * consultation's own region answers, so a change to the region scheme is a
 * change here, not to every response already stored.
 */
export interface CoverageRegion {
  readonly id: string;
  /** Short enough for a tile on the small map. */
  readonly label: string;
  /** Used in sentences and for screen readers. */
  readonly name: string;
  /** The region answers that count towards this region. */
  readonly from: readonly string[];
  /** Where the tile sits on the small map, counted from 1. */
  readonly col: number;
  readonly row: number;
  readonly span?: number;
}

export interface ScoreboardSettings {
  readonly coverage: readonly CoverageRegion[];
  readonly mapColumns: number;
  /** Who is responsible for a commitment, as the reader will see it. */
  readonly owners: readonly string[];
  /**
   * A page for each region, rolling up into the national page. Off for a
   * project that reports nationally, as Potato Mech does; there for any
   * project organised around regions.
   */
  readonly regionalPages: boolean;
}

/**
 * Potato Mech reports nationally, with coverage across the seven regions of
 * the PotatoLink 2 proposal (docs/REGIONS.md), placed roughly where they sit on
 * the map. "Victoria: other districts" cannot be placed in any of them, so it
 * counts nationally only. When the regions are settled, this is the only
 * place that changes.
 */
const POTATO_MECH: ScoreboardSettings = {
  coverage: [
    { id: 'qld', label: 'Qld', name: 'Queensland', from: ['qld'], col: 4, row: 1 },
    { id: 'wa', label: 'WA', name: 'Western Australia', from: ['wa'], col: 1, row: 2, span: 2 },
    { id: 'nsw', label: 'NSW', name: 'New South Wales', from: ['nsw'], col: 4, row: 2 },
    { id: 'sa', label: 'SA', name: 'South Australia and borders', from: ['sa_murraylands', 'sa_southeast'], col: 3, row: 3 },
    { id: 'ballarat', label: 'Ballarat', name: 'Ballarat', from: ['vic_ballarat'], col: 4, row: 3 },
    { id: 'gippsland', label: 'Gipps.', name: 'Gippsland', from: ['vic_gippsland'], col: 5, row: 3 },
    { id: 'tas', label: 'Tas', name: 'Tasmania', from: ['tas_north', 'tas_other'], col: 4, row: 4 },
  ],
  mapColumns: 5,
  owners: ['Potato Mech', 'PotatoLink Phase 2', 'Both projects'],
  regionalPages: false,
};

/** Answers that are not a place: they count nationally and nowhere else. */
const NOT_A_PLACE = new Set(['national', 'other', 'no_say']);

/**
 * Any other project gets one region per place in its own region question,
 * laid out four to a row, and regional pages if it is organised by region.
 */
const fromQuestionnaire = (project: ProjectDefinition): ScoreboardSettings => {
  const places = project.questionnaire.regions.filter((region) => !NOT_A_PLACE.has(region.id));
  return {
    coverage: places.map((region, index) => ({
      id: region.id,
      label: region.label.length > 12 ? `${region.label.slice(0, 11)}…` : region.label,
      name: region.label,
      from: [region.id],
      col: (index % 4) + 1,
      row: Math.floor(index / 4) + 1,
    })),
    mapColumns: 4,
    owners: [project.shortName],
    regionalPages: project.example === true,
  };
};

export const scoreboardSettingsFor = (project: ProjectDefinition): ScoreboardSettings =>
  project.id === 'PT25003' ? POTATO_MECH : fromQuestionnaire(project);
