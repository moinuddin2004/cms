import { AVATAR_TINTS, avatarTintIndex, initialsOf } from './avatar-tint';

describe('avatar tint', () => {
  it('is deterministic and stays inside the 8-tint palette', () => {
    expect(AVATAR_TINTS).toHaveLength(8);
    for (const name of ['Ali Raza', 'Sara Khan', 'City Dental', '']) {
      const i = avatarTintIndex(name);
      expect(i).toBe(avatarTintIndex(name));
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(8);
    }
  });

  it('takes up to two initials', () => {
    expect(initialsOf('ali raza khan')).toBe('AR');
    expect(initialsOf('  Sara ')).toBe('S');
    expect(initialsOf('')).toBe('?');
  });
});
