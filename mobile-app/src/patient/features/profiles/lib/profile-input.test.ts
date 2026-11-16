import type { Profile } from '../types/profiles.types';
import { profileDefaults, toCreateInput, toUpdateInput } from './profile-input';

const kid: Profile = {
  id: 'p1',
  relation: 'child',
  fullName: 'Zain Khan',
  dob: '2018-03-03',
  gender: 'male',
  isSelf: false,
  links: [],
};
const me: Profile = { ...kid, id: 'p0', relation: 'self', isSelf: true };

describe('profile input mapping', () => {
  it('defaults: blank for add, own values for edit', () => {
    expect(profileDefaults()).toEqual({ fullName: '', relation: 'child', dob: '', gender: '' });
    expect(profileDefaults(kid)).toEqual({
      fullName: 'Zain Khan',
      relation: 'child',
      dob: '2018-03-03',
      gender: 'male',
    });
  });

  it('create: trims, drops empty optional fields', () => {
    expect(toCreateInput({ fullName: ' Ali ', relation: 'parent', dob: '', gender: '' })).toEqual({
      relation: 'parent',
      fullName: 'Ali',
    });
    expect(
      toCreateInput({ fullName: 'Ali', relation: 'parent', dob: '1960-01-01', gender: 'male' }),
    ).toEqual({ relation: 'parent', fullName: 'Ali', dob: '1960-01-01', gender: 'male' });
  });

  it('create: never sends self', () => {
    expect(toCreateInput({ fullName: 'A', relation: 'self', dob: '', gender: '' }).relation).toBe('other');
  });

  it('update: sends only the changes', () => {
    expect(toUpdateInput(profileDefaults(kid), kid)).toEqual({});
    expect(toUpdateInput({ ...profileDefaults(kid), fullName: ' Zain K. ' }, kid)).toEqual({
      fullName: 'Zain K.',
    });
    expect(toUpdateInput({ ...profileDefaults(kid), relation: 'other' }, kid)).toEqual({ relation: 'other' });
  });

  it('update: clears an emptied date and gender with null', () => {
    expect(toUpdateInput({ ...profileDefaults(kid), dob: '', gender: '' }, kid)).toEqual({
      dob: null,
      gender: null,
    });
  });

  it('update: your own profile never sends a relation', () => {
    expect(toUpdateInput({ ...profileDefaults(me), relation: 'child' }, me)).toEqual({});
  });
});
