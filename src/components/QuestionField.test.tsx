import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuestionField } from './QuestionField';
import { DEFAULT_QUESTIONNAIRE } from '../content/questionnaire';
import { questionById } from '../content/lookup';
import type { Answer } from '../types';

const practices = questionById(DEFAULT_QUESTIONNAIRE, 'farm_practices');
if (practices === undefined) throw new Error('farm_practices is missing');

const render = (answer: Answer | undefined): string =>
  renderToStaticMarkup(<QuestionField question={practices} answer={answer} onChange={() => undefined} />);

describe('the Something else row', () => {
  it('asks what it is before it asks where they are at', () => {
    const html = render(undefined);
    expect(html).toContain('Something else');
    expect(html).toContain('Write what it is first');
    expect(html).toContain('disabled');
  });

  it('takes a step once something is named', () => {
    const html = render({ kind: 'rating', values: { other: 3 }, other: 'Weeding robot' });
    expect(html).toContain('value="Weeding robot"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('Write what it is first');
  });
});
