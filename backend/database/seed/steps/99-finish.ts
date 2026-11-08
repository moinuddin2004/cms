import { SEED_PASSWORD, SeedContext } from '../lib/context';

export function printLogins(ctx: SeedContext): void {
  const rows = ctx.logins.map((l) => [l.clinic ?? '(platform)', l.role, l.who, l.email]);
  const widths = [0, 1, 2, 3].map((i) => Math.max(...rows.map((r) => r[i].length), 8));
  const line = (r: string[]) => r.map((c, i) => c.padEnd(widths[i])).join('  ');
  // eslint-disable-next-line no-console
  console.log(
    `\nLogins (password for all: ${SEED_PASSWORD})\n` +
      line(['Clinic', 'Role', 'Name', 'Email']) +
      '\n' +
      rows.map(line).join('\n') +
      '\n',
  );
}
