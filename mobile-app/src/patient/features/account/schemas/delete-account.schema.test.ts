import { deleteAccountSchema, DELETE_WORD } from './delete-account.schema';

jest.mock('@/core/i18n', () => ({ t: (key: string) => key }));
describe('deleteAccountSchema', () => {
  it('accepts exactly DELETE (surrounding spaces are trimmed)', () => {
    expect(deleteAccountSchema.safeParse({ confirm: DELETE_WORD }).success).toBe(true);
    expect(deleteAccountSchema.safeParse({ confirm: '  DELETE ' }).success).toBe(true);
  });

  it.each(['', 'delete', 'Delete', 'DELET', 'DELETE ME', 'REMOVE'])('rejects %j', (confirm) => {
    const res = deleteAccountSchema.safeParse({ confirm });
    expect(res.success).toBe(false);
  });
});
