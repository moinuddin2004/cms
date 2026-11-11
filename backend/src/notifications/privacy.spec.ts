import { firstNameOf } from './privacy';

describe('firstNameOf (docs/03 §5 — push text)', () => {
  it.each([
    ['Ali Khan', 'Ali'],
    ['  Ali   Khan ', 'Ali'],
    ['Ali', 'Ali'],
    ['Muhammad Ali Khan', 'Muhammad'],
    ['', ''],
    ['   ', ''],
    [null, ''],
    [undefined, ''],
  ])('%p → %p', (input, expected) => {
    expect(firstNameOf(input)).toBe(expected);
  });

  it('never returns more than the first word', () => {
    expect(firstNameOf('Fatima Noor')).not.toContain('Noor');
  });
});
