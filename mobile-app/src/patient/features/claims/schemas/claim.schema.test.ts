import { claimSchema } from './claim.schema';

const parse = (v: { relation: 'self' | 'child'; newProfileName: string; confirm: boolean }) =>
  claimSchema.safeParse(v).success;

describe('claimSchema', () => {
  it('needs consent', () => {
    expect(parse({ relation: 'self', newProfileName: '', confirm: false })).toBe(false);
  });

  it('self needs no name', () => {
    expect(parse({ relation: 'self', newProfileName: '', confirm: true })).toBe(true);
  });

  it('a dependent needs a name', () => {
    expect(parse({ relation: 'child', newProfileName: '  ', confirm: true })).toBe(false);
    expect(parse({ relation: 'child', newProfileName: 'Ayaan', confirm: true })).toBe(true);
  });
});
