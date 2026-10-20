/** `'a', 'b'` — for CHECK constraints over a fixed list of text values. */
export const sqlList = (values: readonly string[]) =>
  values.map((v) => `'${v}'`).join(', ');
