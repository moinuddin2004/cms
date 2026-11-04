import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AccessContext } from 'src/access/access-context';
import { Patient } from 'src/patients/entities/patient.entity';
import { patientScope } from 'src/patients/access/patient-scope';
import {
  MIN_DIGIT_CHARS,
  MIN_TEXT_CHARS,
  escapeLike,
  isNumericQuery,
  phoneCore,
} from './search-query';
import { SEARCH_TYPES } from './search.types';
import type {
  SearchGroup,
  SearchItem,
  SearchResponse,
  SearchType,
} from './search.types';

const DEFAULT_LIMIT = 5;

/** Digits-only form of a column, matching the trigram indexes in the migration. */
const digits = (col: string) => `regexp_replace(${col}, '\\D', '', 'g')`;

/**
 * Global quick search (Ctrl+K). Each type runs only when the caller holds
 * its view permission, and under the same scope as that type's listing —
 * search never shows a record the listing would hide.
 */
@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
  ) {}

  async search(
    access: AccessContext,
    rawQuery: string,
    types: SearchType[] | undefined,
    limit = DEFAULT_LIMIT,
  ): Promise<SearchResponse> {
    const q = rawQuery.trim();
    const wanted = new Set(types?.length ? types : SEARCH_TYPES);
    const tooShort = isNumericQuery(q)
      ? q.replace(/\D/g, '').length < MIN_DIGIT_CHARS
      : q.length < MIN_TEXT_CHARS;
    if (tooShort) return { query: q, groups: [] };

    const runs: Promise<SearchGroup>[] = [];
    if (wanted.has('patients') && access.can('patients.view')) {
      runs.push(this.searchPatients(access, q, limit));
    }
    const groups = (await Promise.all(runs)).filter((g) => g.items.length);
    return { query: q, groups };
  }

  private async searchPatients(
    access: AccessContext,
    q: string,
    limit: number,
  ): Promise<SearchGroup> {
    const lower = q.toLowerCase();
    const like = `%${escapeLike(lower)}%`;

    const qb = this.patientRepo
      .createQueryBuilder('p')
      .where('p.organization_id = :organizationId', {
        organizationId: access.organizationId,
      });
    access.applyScope(qb, 'patients.view', patientScope('p.id'));

    if (isNumericQuery(q)) {
      const core = phoneCore(q);
      const raw = q.replace(/\D/g, '');
      qb.andWhere(
        `(${digits('p.phone')} LIKE :phoneLike` +
          ` OR ${digits("coalesce(p.guardian_phone, '')")} LIKE :phoneLike` +
          ` OR ${digits("coalesce(p.cnic, '')")} LIKE :cnicPrefix` +
          ` OR lower(p.patient_number) LIKE :like)`,
        {
          phoneLike: `%${core}%`,
          cnicPrefix: `${raw}%`,
          like,
        },
      )
        .addSelect(
          `CASE WHEN lower(p.patient_number) = :lower THEN 0` +
            ` WHEN ${digits('p.phone')} LIKE :phoneEnd THEN 0` +
            ` WHEN ${digits("coalesce(p.cnic, '')")} = :raw THEN 0` +
            ` ELSE 1 END`,
          'search_rank',
        )
        .setParameters({ lower, phoneEnd: `%${core}`, raw });
    } else {
      qb.andWhere(
        '(lower(p.full_name) LIKE :like OR lower(p.patient_number) LIKE :like' +
          ' OR lower(p.full_name) % :lower)',
        { like, lower },
      )
        .addSelect(
          `CASE WHEN lower(p.patient_number) = :lower THEN 0` +
            ` WHEN lower(p.full_name) LIKE :prefix THEN 1` +
            ` WHEN lower(p.full_name) LIKE :like OR lower(p.patient_number) LIKE :like THEN 2` +
            ` ELSE 3 END`,
          'search_rank',
        )
        .setParameters({ prefix: `${escapeLike(lower)}%` });
    }

    qb.addSelect('similarity(lower(p.full_name), :lower)', 'search_sim')
      .orderBy('search_rank', 'ASC')
      .addOrderBy('search_sim', 'DESC')
      .addOrderBy('p.is_active', 'DESC')
      .addOrderBy('p.updated_at', 'DESC')
      .limit(limit + 1);

    const rows = await qb.getMany();
    return {
      type: 'patients',
      items: rows.slice(0, limit).map(toPatientItem),
      hasMore: rows.length > limit,
    };
  }
}

function toPatientItem(p: Patient): SearchItem {
  const badges: string[] = [];
  if (!p.isActive) badges.push('Inactive');
  if (p.isBlacklisted) badges.push('Blacklisted');
  return {
    id: p.id,
    type: 'patients',
    title: p.fullName,
    subtitle: [p.patientNumber, p.phone].filter(Boolean).join(' · ') || null,
    href: `/patients/${p.id}`,
    badges,
  };
}
