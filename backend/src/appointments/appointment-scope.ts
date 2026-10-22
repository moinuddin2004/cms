import type { AccessContext, ScopeColumns } from 'src/access/access-context';
import type { Permission } from 'src/access/catalog/permissions';

/**
 * `AccessContext.applyScope` for hand-written SQL: collects the clause it
 * would add and renumbers its named parameter through `arg` (which returns
 * the `$n` placeholder). Returns `AND …` or an empty string.
 */
export function scopeSql(
  access: AccessContext,
  perm: Permission,
  cols: ScopeColumns,
  arg: (value: unknown) => string,
): string {
  const clauses: string[] = [];
  access.applyScope(
    {
      andWhere(where: string, params?: Record<string, unknown>) {
        let sql = where;
        for (const [name, value] of Object.entries(params ?? {})) {
          sql = sql.replace(`:${name}`, arg(value));
        }
        clauses.push(sql);
      },
    },
    perm,
    cols,
  );
  return clauses.map((c) => `AND ${c}`).join(' ');
}

/** The same rule for one loaded row: `own` → its employee, `location` → its location. */
export function rowInScope(
  access: AccessContext,
  perm: Permission,
  row: { own?: string | null; location?: string | null },
): boolean {
  const scope = access.scope(perm);
  if (scope === null) return false;
  if (scope === 'org') return true;
  if (scope === 'location') {
    return !!access.locationId && row.location === access.locationId;
  }
  return !!access.employeeId && row.own === access.employeeId;
}
