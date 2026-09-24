import { describe, expect, it } from 'vitest';
import { contactNames, parseContacts, telHref } from './config';

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

  it('keeps a name with no number, because the call-back form is the way in', () => {
    expect(parseContacts("Peter O'Brien;Steph Tabone")).toEqual([
      { name: "Peter O'Brien", phone: '', email: '' },
      { name: 'Steph Tabone', phone: '', email: '' },
    ]);
  });

  it('drops an entry with no name, which is nobody', () => {
    expect(parseContacts('')).toEqual([]);
    expect(parseContacts('|0409 773 111|')).toEqual([]);
  });
});

describe('contactNames', () => {
  it('reads as a sentence would', () => {
    expect(contactNames(parseContacts("Peter O'Brien"))).toBe("Peter O'Brien");
    expect(contactNames(parseContacts("Peter O'Brien;Steph Tabone"))).toBe("Peter O'Brien or Steph Tabone");
    expect(contactNames(parseContacts('A;B;C'))).toBe('A, B or C');
    expect(contactNames([])).toBe('');
  });
});

describe('telHref', () => {
  it('strips the spaces a number is written with, so it still dials', () => {
    expect(telHref('0409 773 111')).toBe('tel:0409773111');
    expect(telHref('+61 409 773 111')).toBe('tel:+61409773111');
  });
});
