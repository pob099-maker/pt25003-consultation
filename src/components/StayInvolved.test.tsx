import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StayInvolved } from './StayInvolved';
import { DEFAULT_QUESTIONNAIRE, NO_INTEREST_ID, interestsForPathway } from '../content/questionnaire';

const render = (interests: readonly string[]): string =>
  renderToStaticMarkup(
    <StayInvolved
      interestOptions={interestsForPathway(DEFAULT_QUESTIONNAIRE, 'farm')}
      contactMethods={DEFAULT_QUESTIONNAIRE.contactMethods}
      interests={interests}
      onInterestsChange={() => {}}
      formId="contact"
      onSubmit={() => {}}
    />,
  );

describe('StayInvolved', () => {
  it('offers the contact boxes before anything is ticked', () => {
    const html = render([]);
    expect(html).toContain('Your contact details');
    expect(html).toContain('id="email"');
  });

  it('takes them away once somebody says none of these', () => {
    expect(render([NO_INTEREST_ID])).not.toContain('id="email"');
  });
});
