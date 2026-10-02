import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScoreboardView } from './ScoreboardView';
import { PROJECTS } from '../content/projects';
import { scoreboardSettingsFor } from '../content/scoreboardSettings';
import { defaultBlocks, demoSeed, type Edition } from '../services/scoreboard';

const settings = scoreboardSettingsFor(PROJECTS.PT25003 as NonNullable<typeof PROJECTS.PT25003>);
const seeded = demoSeed(new Date('2026-11-10')).editions[0] as Edition;

const render = (edition: Edition): string => {
  const snapshot = edition.content.snapshot;
  if (snapshot === null) throw new Error('the example is published');
  return renderToStaticMarkup(
    <ScoreboardView
      edition={edition}
      numbers={snapshot.participation}
      items={snapshot.items}
      settings={settings}
      projectName="Potato Mechanisation Project"
      projectReference="PT25003"
    />,
  );
};

describe('ScoreboardView', () => {
  it('says it plainly at the top', () => {
    const html = render(seeded);
    expect(html).toContain('You said. We heard.');
    expect(html).toContain('We’re acting.');
  });

  it('leaves out every optional block that is switched off', () => {
    const plain: Edition = { ...seeded, content: { ...seeded.content, blocks: defaultBlocks() } };
    const html = render(plain);
    expect(html).not.toContain('Everything you raised');
    expect(html).not.toContain('Story of the month');
    expect(html).not.toContain('You asked');
    expect(html).toContain('What we&#x27;re doing');
  });

  it('shows a register that answers no, and says why', () => {
    const html = render(seeded);
    expect(html).toContain('Not taking forward');
    expect(html).toContain('Levy funds pay for research and extension');
  });

  it('writes a small figure as fewer than five, never as the number', () => {
    const snapshot = seeded.content.snapshot;
    if (snapshot === null) throw new Error('published');
    const thin: Edition = {
      ...seeded,
      content: { ...seeded.content, snapshot: { ...snapshot, participation: { ...snapshot.participation, total: null, weekly: [] } } },
    };
    expect(render(thin)).toContain('Fewer than 5');
  });

  it('marks a summary as a summary and a quote as given with permission', () => {
    const quoted: Edition = {
      ...seeded,
      content: {
        ...seeded.content,
        findings: [{ id: 'q', theme: '', said: { kind: 'quote', text: 'Proof first.' }, heard: 'Evidence matters.', howWeKnow: '', regionsRaised: null, regionsHeardFrom: null }],
      },
    };
    expect(render(quoted)).toContain('Quoted with permission');
    expect(render(seeded)).toContain('Summary of what people told us');
  });
});
