import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActorRef, TransitionVia } from 'src/common/audit/audit.enums';
import { sqlRows } from 'src/common/database/sql';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import { labError } from '../common/lab-errors';
import { labCounts, likePattern } from '../common/lab-query';
import {
  AddLabMemberDto,
  LabLinkTransitionDto,
  UpdateLabMemberDto,
} from '../dto/lab.dto';
import { LabsDirectoryService } from '../directory/labs-directory.service';
import { Lab } from '../entities/lab.entity';
import { LabClinicLink } from '../entities/lab-clinic-link.entity';
import { LabMember } from '../entities/lab-member.entity';
import { LabLinkStatus } from '../enums/lab.enums';
import { LabLinksService } from '../links/lab-links.service';
import {
  LabMemberResponse,
  LabSummary,
  toLabSummary,
} from '../mappers/lab-response';
import { LabMembersService } from '../members/lab-members.service';
import { findLabMemberships, LabMembership } from './lab-memberships';
import type { LabActorContext } from './lab-portal.constants';
import { PortalClinicsQueryDto, UpdateLabContactDto } from './lab-portal.dto';
import { LabScopedService } from './lab-scoped';

/** The lab's own profile as the portal shows it. */
export interface PortalLabProfile extends LabSummary {
  memberCount: number;
  activeLinkCount: number;
  version: number;
  updatedAt: Date;
}

/**
 * A clinic as a lab sees it: the clinic's name and city plus the link's own
 * status and payment terms — never clinic prices, invoices, ids, notes or
 * patients (lab ERD §13). `id` / `version` are the link's, for transitions.
 */
export interface PortalClinic {
  id: string;
  status: LabLinkStatus;
  paymentTermsDays: number;
  version: number;
  clinic: { name: string; city: string | null };
}

interface PortalClinicRow {
  id: string;
  status: LabLinkStatus;
  payment_terms_days: number;
  version: number;
  name: string;
  city: string | null;
}

/**
 * Lab portal reads and writes, always for `actor.labId` — the guard has
 * already proved an active membership of that (active) lab. Writes reuse
 * the Sprint 1 services with a lab-side audit actor.
 */
@Injectable()
export class LabPortalService extends LabScopedService {
  constructor(
    @InjectDataSource() dataSource: DataSource,
    private readonly directory: LabsDirectoryService,
    private readonly members: LabMembersService,
    private readonly links: LabLinksService,
  ) {
    super(dataSource);
  }

  me(userId: string): Promise<LabMembership[]> {
    return findLabMemberships(this.dataSource.manager, userId);
  }

  async profile(actor: LabActorContext): Promise<PortalLabProfile> {
    const m = this.dataSource.manager;
    const lab = await m.getRepository(Lab).findOneByOrFail({
      id: actor.labId,
    });
    const counts = await labCounts(m, [lab.id]);
    return {
      ...toLabSummary(lab),
      ...counts.get(lab.id)!,
      version: lab.version,
      updatedAt: lab.updatedAt,
    };
  }

  async updateContact(
    actor: LabActorContext,
    dto: UpdateLabContactDto,
    audit: ActorRef,
  ): Promise<PortalLabProfile> {
    await this.directory.update(actor.labId, dto, audit);
    return this.profile(actor);
  }

  listMembers(actor: LabActorContext): Promise<LabMemberResponse[]> {
    return this.members.list(actor.labId);
  }

  addMember(
    actor: LabActorContext,
    dto: AddLabMemberDto,
    audit: ActorRef,
  ): Promise<LabMemberResponse> {
    return this.members.add(actor.labId, dto, audit);
  }

  /**
   * Role / active changes — never on yourself, so a lab admin can't lock
   * the lab out by demoting or deactivating the last admin.
   */
  async updateMember(
    actor: LabActorContext,
    memberId: string,
    dto: UpdateLabMemberDto,
    audit: ActorRef,
  ): Promise<LabMemberResponse> {
    const member = await this.findScoped(LabMember, memberId, actor);
    if (!member) throw labError('LAB_MEMBER_NOT_FOUND', 'Member not found');
    if (member.userId === actor.userId) {
      throw labError(
        'LAB_MEMBER_SELF_CHANGE',
        'You cannot change your own membership — ask another lab admin',
      );
    }
    return this.members.update(actor.labId, memberId, dto, audit);
  }

  async clinics(
    actor: LabActorContext,
    q: PortalClinicsQueryDto,
  ): Promise<PortalClinic[]> {
    const params: unknown[] = [actor.labId];
    let filter = '';
    if (q.status) {
      params.push(q.status);
      filter += ` AND k.status = $${params.length}`;
    }
    if (q.search) {
      params.push(likePattern(q.search));
      filter += ` AND o.name ILIKE $${params.length}`;
    }
    const rows = await sqlRows<PortalClinicRow>(
      this.dataSource,
      `SELECT k.id, k.status, k.payment_terms_days, k.version, o.name,
              (SELECT loc.city FROM locations loc
                WHERE loc.organization_id = o.id AND loc.is_active
                  AND loc.city IS NOT NULL
                ORDER BY loc.is_main_branch DESC, loc.created_at
                LIMIT 1) AS city
         FROM lab_clinic_links k
         JOIN organizations o ON o.id = k.organization_id
        WHERE k.lab_id = $1${filter}
        ORDER BY o.name, k.id`,
      params,
    );
    return rows.map(toPortalClinic);
  }

  /** Accept an invitation, suspend or reactivate — from the lab's side. */
  async transitionClinic(
    actor: LabActorContext,
    linkId: string,
    dto: LabLinkTransitionDto,
    audit: ActorRef,
  ): Promise<PortalClinic> {
    await this.dataSource.transaction(async (m) => {
      const link = await this.scoped(LabClinicLink, 'k', actor, m)
        .andWhere('k.id = :linkId', { linkId })
        .setLock('pessimistic_write')
        .getOne();
      if (!link) throw labError('LAB_LINK_NOT_FOUND', 'Clinic not found');
      assertVersion(link.version, dto.version);
      await this.links.applyTransition(
        m,
        link,
        dto.action,
        audit,
        dto.reason ?? null,
        TransitionVia.PORTAL,
      );
    });
    const clinics = await this.clinics(actor, {});
    return clinics.find((c) => c.id === linkId)!;
  }
}

function toPortalClinic(r: PortalClinicRow): PortalClinic {
  return {
    id: r.id,
    status: r.status,
    paymentTermsDays: Number(r.payment_terms_days),
    version: Number(r.version),
    clinic: { name: r.name, city: r.city },
  };
}
