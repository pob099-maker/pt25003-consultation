import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PreferToTalk } from './PreferToTalk';

const html = renderToStaticMarkup(<PreferToTalk />);

describe('PreferToTalk', () => {
  it('offers the call-back whether or not a number is published', () => {
    // The offer used to depend on VITE_PROJECT_CONTACTS being set, and the
    // whole section vanished without it. Leaving a number needs nobody's
    // mobile in the page, so it stands on its own.
    expect(html).toContain('Ask us to ring you');
    expect(html).toContain('Would you rather talk to someone?');
  });

  it('starts closed, so the landing page is not a form', () => {
    expect(html).not.toContain('When is the best time to ring?');
  });
});
