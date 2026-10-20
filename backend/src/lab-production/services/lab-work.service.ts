import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { sqlRows } from 'src/common/database/sql';
import { assertVersion } from 'src/common/errors/optimistic-lock';
import {
  LabCall,
  labRef,
  labTransitionActor,
} from 'src/lab-orders/common/order-context';
import { LabMember } from 'src/labs/entities/lab-member.entity';
import { productionError } from '../common/production-errors';
import { CLOSED_ITEM_STATES, labItem } from '../common/production-items';
import { QcDto } from '../dto/production.dto';
import {
  ItemAssignment,
  RemakeRequest,
} from '../entities/production-records.entity';
import {
  PRODUCTION_ENTITY,
  QcResult,
  RemakeStatus,
} from '../enums/production.enums';
import { ProductionNotifier } from '../workflow/production-notifier';
import {
  ProductionWorkflowService,
  STAGE_STATE,
} from '../workflow/production-workflow.service';

/**
 * The lab's bench work (lab ERD §14 step 6): start, technician assignment,
 * finish → QC → ready. Every status change goes through `transition()`;
 * stages follow automatically (the item listener starts the next round).
 */
@Injectable()
export class LabWorkService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly production: ProductionWorkflowService,
    private readonly notifier: ProductionNotifier,
  ) {}

  /** accepted → in_production; stages are created if missing and round 1 starts. */
  async start(c: LabCall, itemId: string, version?: number): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const item = await labItem(m, c.lab.labId, itemId);
      await this.production.item(
        m,
        item.organization_id,
        item.id,
        'start',
        labTransitionActor(c),
        { expectedVersion: version },
      );
    });
  }

  /** Work done → QC. With stages, only once the final stage is at the lab. */
  async finish(c: LabCall, itemId: string, version?: number): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const item = await labItem(m, c.lab.labId, itemId);
      if (await this.production.hasStages(m, item.id)) {
        const stage = await this.production.activeStage(m, item.id);
        if (
          !stage ||
          !stage.isFinal ||
          stage.statusCode !== STAGE_STATE.AT_LAB
        ) {
          throw productionError(
            'PRODUCTION_NOT_ALLOWED',
            stage && !stage.isFinal
              ? `Send ${stage.nameSnap} for try-in first — the final stage comes after the try-ins`
              : 'The final stage is not at the lab',
          );
        }
      }
      await this.production.item(
        m,
        item.organization_id,
        item.id,
        'finish',
        labTransitionActor(c),
        { expectedVersion: version },
      );
    });
  }

  /** QC pass → ready (doctor told the work is ready); fail → back to production. */
  async qc(c: LabCall, itemId: string, dto: QcDto): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const item = await labItem(m, c.lab.labId, itemId);
      const pass = dto.result === QcResult.PASS;
      await this.production.item(
        m,
        item.organization_id,
        item.id,
        pass ? 'qc_pass' : 'qc_fail',
        labTransitionActor(c),
        { expectedVersion: dto.version, reason: dto.notes ?? null },
      );
      if (pass) {
        await this.notifier.toDoctor(
          m,
          item.order_id,
          'item.ready',
          { item_name: item.service_name_snap },
          { patient: true },
        );
      }
    });
  }

  /** Assigns a technician; the previous open assignment is closed, not edited. */
  async assign(c: LabCall, itemId: string, labMemberId: string): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const item = await labItem(m, c.lab.labId, itemId);
      if (CLOSED_ITEM_STATES.has(item.status_code)) {
        throw productionError(
          'PRODUCTION_NOT_ALLOWED',
          `This item is ${item.status_code}`,
        );
      }
      const member = await m.getRepository(LabMember).findOneBy({
        id: labMemberId,
        labId: c.lab.labId,
        isActive: true,
      });
      if (!member) {
        throw productionError(
          'PRODUCTION_MEMBER_NOT_FOUND',
          'Technician not found in this lab',
        );
      }
      await m.query(`SELECT id FROM lab_order_items WHERE id = $1 FOR UPDATE`, [
        item.id,
      ]);
      const repo = m.getRepository(ItemAssignment);
      const current = await this.openOf(m, item.id);
      if (current?.labMemberId === member.id) return;
      if (current) await this.close(m, current, c.lab.userId);
      const row = await repo.save(
        repo.create({
          organizationId: item.organization_id,
          labId: c.lab.labId,
          itemId: item.id,
          labMemberId: member.id,
          assignedBy: c.lab.userId,
        }),
      );
      await this.audit.record(m, labRef(c), {
        organizationId: item.organization_id,
        entityType: PRODUCTION_ENTITY.ASSIGNMENT,
        entityId: row.id,
        action: AuditAction.CREATE,
        after: { itemId: item.id, labMemberId: member.id },
      });
    });
  }

  async unassign(c: LabCall, itemId: string): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const item = await labItem(m, c.lab.labId, itemId);
      await m.query(`SELECT id FROM lab_order_items WHERE id = $1 FOR UPDATE`, [
        item.id,
      ]);
      const current = await this.openOf(m, item.id);
      if (current) await this.close(m, current, c.lab.userId);
    });
  }

  /** Active members of the lab — who work can be assigned to. */
  technicians(labId: string) {
    return sqlRows<{ id: string; name: string | null; role: string }>(
      this.dataSource,
      `SELECT lm.id, u.name, lm.role FROM lab_members lm JOIN users u ON u.uuid = lm.user_id
        WHERE lm.lab_id = $1 AND lm.is_active ORDER BY u.name`,
      [labId],
    );
  }

  /** The lab disagrees with a remake request (e.g. not its fault). */
  async dispute(
    c: LabCall,
    remakeId: string,
    version: number,
    note: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const r = await m.getRepository(RemakeRequest).findOne({
        where: { id: remakeId, labId: c.lab.labId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!r) {
        throw productionError(
          'PRODUCTION_REMAKE_NOT_FOUND',
          'Remake request not found',
        );
      }
      assertVersion(r.version, version);
      if (r.status !== RemakeStatus.REQUESTED) {
        throw productionError(
          'PRODUCTION_NOT_ALLOWED',
          `This remake request is ${r.status}`,
        );
      }
      r.status = RemakeStatus.DISPUTED;
      r.disputeNote = note.trim();
      await m.getRepository(RemakeRequest).save(r);
      await this.audit.record(m, labRef(c), {
        organizationId: r.organizationId,
        entityType: PRODUCTION_ENTITY.REMAKE,
        entityId: r.id,
        action: AuditAction.UPDATE,
        before: { status: RemakeStatus.REQUESTED },
        after: { status: RemakeStatus.DISPUTED, disputeNote: r.disputeNote },
      });
    });
  }

  private async openOf(m: EntityManager, itemId: string) {
    return m
      .getRepository(ItemAssignment)
      .createQueryBuilder('a')
      .where('a.item_id = :itemId AND a.unassigned_at IS NULL', { itemId })
      .getOne();
  }

  private async close(
    m: EntityManager,
    a: ItemAssignment,
    userId: string,
  ): Promise<void> {
    await m
      .getRepository(ItemAssignment)
      .update({ id: a.id }, { unassignedAt: new Date(), unassignedBy: userId });
  }
}
