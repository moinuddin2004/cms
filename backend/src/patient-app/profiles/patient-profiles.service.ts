import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { assertProfile, type PatientContext } from '../context/patient-context';
import type {
  PatientProfileGender,
  PatientProfileRelation,
} from '../entities/patient-profile.entity';
import { PatientAccountLinksService } from '../links/patient-account-links.service';
import {
  CreateProfileDto,
  PatientProfileDto,
  UpdateProfileDto,
} from './patient-profiles.dto';

/** An account manages a family, not a clinic: a sane ceiling stops abuse. */
export const MAX_PROFILES_PER_ACCOUNT = 20;

/** Replaces the name of a soft-deleted profile (`full_name` is NOT NULL). */
export const REMOVED_PROFILE_NAME = 'Removed profile';

interface ProfileRow {
  id: string;
  relation: PatientProfileRelation;
  full_name: string;
  dob: string | null;
  gender: PatientProfileGender | null;
}

const PROFILE_COLUMNS = `id, relation, full_name, dob::text AS dob, gender`;

/**
 * The account's profiles (self + family, P-04). Profile data is the patient's
 * own and never touches the clinic record. Every statement is scoped to the
 * signed-in account (`account_id = ctx.accountId`) and ids from the client are
 * checked against `ctx.profiles` first (A-05).
 */
@Injectable()
export class PatientProfilesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly links: PatientAccountLinksService,
  ) {}

  async list(ctx: PatientContext): Promise<PatientProfileDto[]> {
    const [rows, links] = await Promise.all([
      sqlRows<ProfileRow>(
        this.dataSource,
        `SELECT ${PROFILE_COLUMNS} FROM patient_profiles
          WHERE account_id = $1 AND deleted_at IS NULL
          ORDER BY (relation = 'self') DESC, created_at ASC`,
        [ctx.accountId],
      ),
      this.links.list(ctx, { includeRevoked: false }),
    ]);
    return rows.map((r) => toDto(r, links));
  }

  async create(
    ctx: PatientContext,
    dto: CreateProfileDto,
  ): Promise<PatientProfileDto> {
    const row = await this.dataSource.transaction(async (m) => {
      // Serialise with a concurrent account deletion (it locks this row first)
      // and with other creates, so the cap cannot be raced; a deleted account
      // gets nothing.
      const lockedAccount = await sqlRows<{ id: string }>(
        m,
        `SELECT id FROM patient_accounts
          WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [ctx.accountId],
      );
      if (lockedAccount.length === 0) throw notFound();
      const [{ n }] = await sqlRows<{ n: number }>(
        m,
        `SELECT count(*)::int AS n FROM patient_profiles
          WHERE account_id = $1 AND deleted_at IS NULL`,
        [ctx.accountId],
      );
      if (n >= MAX_PROFILES_PER_ACCOUNT) {
        throw new ConflictException({
          code: 'TOO_MANY_PROFILES',
          message: 'Too many family members on this account',
        });
      }
      const [created] = await sqlRows<ProfileRow>(
        m,
        `INSERT INTO patient_profiles (account_id, relation, full_name, dob, gender)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${PROFILE_COLUMNS}`,
        [
          ctx.accountId,
          dto.relation,
          dto.fullName,
          dto.dob ?? null,
          dto.gender ?? null,
        ],
      );
      return created;
    });
    return toDto(row, []);
  }

  async update(
    ctx: PatientContext,
    profileId: string,
    dto: UpdateProfileDto,
  ): Promise<PatientProfileDto> {
    const profile = assertProfile(ctx, profileId);
    if (dto.relation !== undefined && profile.isSelf) {
      throw new BadRequestException({
        code: 'SELF_RELATION_FIXED',
        message: 'Your own profile keeps its relation',
      });
    }

    const sets: string[] = [];
    const params: unknown[] = [profileId, ctx.accountId];
    const add = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    // Omitted = unchanged. `null` clears dob / gender; name and relation cannot be null.
    if (dto.fullName !== undefined && dto.fullName !== null) {
      add('full_name', dto.fullName);
    }
    if (dto.relation !== undefined && dto.relation !== null) {
      add('relation', dto.relation);
    }
    if (dto.dob !== undefined) add('dob', dto.dob);
    if (dto.gender !== undefined) add('gender', dto.gender);

    if (sets.length > 0) {
      const res = await sqlRows<ProfileRow>(
        this.dataSource,
        `UPDATE patient_profiles SET ${sets.join(', ')}, updated_at = now()
          WHERE id = $1 AND account_id = $2 AND deleted_at IS NULL
          RETURNING ${PROFILE_COLUMNS}`,
        params,
      );
      if (res.length === 0) throw notFound();
    }

    const dtoOut = (await this.list(ctx)).find((p) => p.id === profileId);
    if (!dtoOut) throw notFound();
    return dtoOut;
  }

  /**
   * Remove a family member (soft delete, A-22). Your own profile stays; a
   * profile that still has a clinic link must be unlinked first (so the clinic
   * audit trail of the unlink exists), then it can go. Its revoked link rows
   * are kept.
   */
  async remove(
    ctx: PatientContext,
    profileId: string,
  ): Promise<{ removed: true }> {
    const profile = assertProfile(ctx, profileId);
    if (profile.isSelf) {
      throw new BadRequestException({
        code: 'CANNOT_REMOVE_SELF',
        message: 'You cannot remove your own profile',
      });
    }
    await this.dataSource.transaction(async (m) => {
      // Lock the profile, then count its live links under that lock.
      const locked = await sqlRows<{ id: string }>(
        m,
        `SELECT id FROM patient_profiles
          WHERE id = $1 AND account_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [profileId, ctx.accountId],
      );
      if (locked.length === 0) throw notFound();
      const [{ n }] = await sqlRows<{ n: number }>(
        m,
        `SELECT count(*)::int AS n FROM patient_record_links
          WHERE profile_id = $1 AND status IN ('active', 'frozen')`,
        [profileId],
      );
      if (n > 0) {
        throw new ConflictException({
          code: 'PROFILE_HAS_LINKS',
          message: 'Unlink this family member from their clinics first',
        });
      }
      // Reminders + dose history of this person are deleted too (cascade from the schedules);
      // the profile is only soft-deleted so the FK cascade would never fire. Audit H2.
      await m.query(
        `DELETE FROM medication_schedules WHERE profile_id = ANY($1)`,
        [[profileId]],
      );
      // Soft delete (A-22): the revoked links of this profile stay as the
      // clinic's history; the person's data goes.
      await m.query(
        `UPDATE patient_profiles
            SET deleted_at = now(), full_name = $3, dob = NULL, gender = NULL,
                private_reminders = false, updated_at = now()
          WHERE id = $1 AND account_id = $2`,
        [profileId, ctx.accountId, REMOVED_PROFILE_NAME],
      );
    });
    return { removed: true };
  }
}

function notFound(): NotFoundException {
  return new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
}

function toDto(
  r: ProfileRow,
  links: Awaited<ReturnType<PatientAccountLinksService['list']>>,
): PatientProfileDto {
  return {
    id: r.id,
    relation: r.relation,
    fullName: r.full_name,
    dob: r.dob,
    gender: r.gender,
    isSelf: r.relation === 'self',
    links: links
      .filter((l) => l.profileId === r.id && l.status !== 'revoked')
      .map((l) => ({
        id: l.id,
        clinic: l.clinic,
        location: l.location,
        status: l.status as 'active' | 'frozen',
        linkedAt: l.linkedAt,
      })),
  };
}
