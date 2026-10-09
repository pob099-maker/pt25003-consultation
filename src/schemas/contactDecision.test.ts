import { describe, expect, it } from 'vitest';
import { contactDecision, type ContactFormValues } from './consultation';

const blank: ContactFormValues = {
  name: '',
  organisation: '',
  broadRole: '',
  region: '',
  email: '',
  phone: '',
  preferredContactMethod: 'email',
  preferredContactTime: '',
  comments: '',
};

describe('contactDecision', () => {
  it('lets somebody leave their details without ticking anything', () => {
    expect(contactDecision([], { ...blank, email: 'grower@example.com' }, 'none')).toBe('send');
  });

  it('treats nothing ticked and nothing filled in as no thanks', () => {
    expect(contactDecision([], blank, 'none')).toBe('skip');
  });

  it('asks for an email or a phone number once a box is filled in', () => {
    expect(contactDecision([], { ...blank, name: 'Sam' }, 'none')).toBe('needs-reach');
  });

  it('still asks for a way to reach somebody who ticked something', () => {
    expect(contactDecision(['summary'], blank, 'none')).toBe('needs-reach');
    expect(contactDecision(['summary'], { ...blank, phone: '0400 000 000' }, 'none')).toBe('send');
  });

  it('keeps nothing from somebody who chose none of these', () => {
    expect(contactDecision(['none'], { ...blank, email: 'grower@example.com' }, 'none')).toBe('skip');
  });
});
