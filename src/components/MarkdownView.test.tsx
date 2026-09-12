import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownView } from './MarkdownView';
import { buildPhoneScript } from '../content/phoneScript';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';

const render = (source: string): string => renderToStaticMarkup(<MarkdownView source={source} />);

describe('MarkdownView', () => {
  it('renders the marks rather than printing them', () => {
    const html = render('**bold** and _soft_ and `code`');
    expect(html).toContain('<strong');
    expect(html).toContain('<em');
    expect(html).toContain('<code');
    expect(html).not.toContain('**');
  });

  it('groups consecutive bullets into one list', () => {
    const html = render('- one\n- two\n- three');
    expect(html.match(/<ul/g)).toHaveLength(1);
    expect(html.match(/<li/g)).toHaveLength(3);
  });

  it('leaves no stray markers anywhere in the real phone script', () => {
    // The renderer only has to handle what our own generators emit. This is
    // the check that the closed grammar really is closed: if a generator
    // starts emitting something new, the marks show up on screen and here.
    const html = render(buildPhoneScript(DEFAULT_QUESTIONNAIRE));
    const text = html.replace(/<[^>]+>/g, '');
    expect(text).not.toContain('**');
    expect(text).not.toMatch(/(^|\s)#{1,4}\s/);
    expect(text).not.toMatch(/(^|\s)- /);
  });

  it('keeps every question in the rendered script', () => {
    const html = render(buildPhoneScript(DEFAULT_QUESTIONNAIRE));
    for (const section of DEFAULT_QUESTIONNAIRE.core) {
      for (const question of section.questions) {
        // Apostrophes and ampersands are escaped in HTML; compare on the words.
        const words = question.prompt.split(' ').slice(0, 4).join(' ');
        expect(html).toContain(words.replace(/&/g, '&amp;'));
      }
    }
  });
});
