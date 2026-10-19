import { EntityManager } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { LabLinkStatus } from '../enums/lab.enums';

/** `%term%` for ILIKE with the user's `%`, `_` and `\` taken literally. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Active member and active-link counts per lab, for listing cards. */
export async function labCounts(
  manager: EntityManager,
  labIds: string[],
): Promise<Map<string, { memberCount: number; activeLinkCount: number }>> {
  const out = new Map<
    string,
    { memberCount: number; activeLinkCount: number }
  >();
  for (const id of labIds) out.set(id, { memberCount: 0, activeLinkCount: 0 });
  if (!labIds.length) return out;

  const rows = await sqlRows<{
    lab_id: string;
    members: string;
    links: string;
  }>(
    manager,
    `SELECT l.id AS lab_id,
            (SELECT count(*) FROM lab_members m
              WHERE m.lab_id = l.id AND m.is_active) AS members,
            (SELECT count(*) FROM lab_clinic_links k
              WHERE k.lab_id = l.id AND k.status = $2) AS links
       FROM labs l
      WHERE l.id = ANY($1::uuid[])`,
    [labIds, LabLinkStatus.ACTIVE],
  );
  for (const r of rows) {
    out.set(r.lab_id, {
      memberCount: Number(r.members),
      activeLinkCount: Number(r.links),
    });
  }
  return out;
}
