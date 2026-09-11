import { describe, expect, it } from 'vitest';
import { parseContacts, telHref } from './config';

describe('parseContacts', () => {
  it('reads one contact', () => {
    expect(parseContacts("Peter O'Brien|0409 773 111|")).toEqual([
      { name: "Peter O'Brien", phone: '0409 773 111', email: '' },
    ]);
  });

  it('reads several, so a second name is an environment change and not a code change', () => {
    const contacts = parseContacts("Peter O'Brien|0409 773 111|; Jane Citizen||jane@example.com");
    expect(contacts).toHaveLength(2);
    expect(contacts[1]).toEqual({ name: 'Jane Citizen', phone: '', email: 'jane@example.com' });
  });

  it('drops an entry with no way to reach the person', () => {
    // A name on its own reads as an offer to talk that cannot be taken up.
    expect(parseContacts('Nobody||')).toEqual([]);
    expect(parseContacts('')).toEqual([]);
  });
});

describe('telHref', () => {
  it('strips the spaces a number is written with, so it still dials', () => {
    expect(telHref('0409 773 111')).toBe('tel:0409773111');
    expect(telHref('+61 409 773 111')).toBe('tel:+61409773111');
  });
});
