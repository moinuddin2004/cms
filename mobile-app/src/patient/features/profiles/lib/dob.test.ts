import { checkDob } from './dob';

const TODAY = '2026-11-15';

describe('checkDob', () => {
  it.each([
    ['2018-03-03', 'ok'],
    ['2026-11-15', 'ok'],
    ['2026-11-16', 'future'],
    ['2999-01-01', 'future'],
    ['2018-02-30', 'invalid'],
    ['2019-02-29', 'invalid'],
    ['2020-02-29', 'ok'],
    ['1899-12-31', 'invalid'],
    ['03/03/2018', 'invalid'],
    ['', 'invalid'],
  ])('%s → %s', (value, expected) => {
    expect(checkDob(value, TODAY)).toBe(expected);
  });
});
