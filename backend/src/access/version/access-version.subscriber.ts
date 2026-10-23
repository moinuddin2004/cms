import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  QueryRunner,
  RemoveEvent,
  SoftRemoveEvent,
  TransactionCommitEvent,
  TransactionRollbackEvent,
  UpdateEvent,
} from 'typeorm';
import { EmploymentRole } from 'src/employees/entities/employment-role.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { OrgFeatureFlag } from 'src/feature-flags/entities/org-feature-flag.entity';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { AccessVersionService } from './access-version.service';

/**
 * Which writes change access. `null` = any column; otherwise only updates
 * touching one of these properties bump the version.
 */
const WATCHED = new Map<object, ReadonlySet<string> | null>([
  [EmploymentRole, null],
  [
    EmployeeOrgLocationAssignment,
    new Set([
      'employmentRoleId',
      'employmentRole',
      'locationId',
      'organizationId',
      'isActive',
      'hasPortalAccess',
      'userId',
    ]),
  ],
  [OrgFeatureFlag, null],
  [OrganizationOwnership, null],
]);

const PENDING_KEY = 'accessVersionPendingOrgs';

type OrgScoped = { organizationId?: string | null } | undefined;

/**
 * Bumps `organizations.access_version` whenever a watched entity is written
 * through TypeORM (save / remove / query-builder update with listeners), so
 * no service has to remember to. Inside a transaction the bump waits for the
 * outermost COMMIT (dropped on ROLLBACK); one bump per org per transaction.
 *
 * Not seen: raw SQL and DB-level cascades (e.g. deleting an employee) —
 * callers doing those bump explicitly via AccessVersionService.
 */
@Injectable()
export class AccessVersionSubscriber implements EntitySubscriberInterface {
  constructor(
    @InjectDataSource() dataSource: DataSource,
    private readonly versions: AccessVersionService,
  ) {
    dataSource.subscribers.push(this);
  }

  afterInsert(event: InsertEvent<unknown>) {
    if (!WATCHED.has(event.metadata.target as object)) return;
    return this.touch(event.queryRunner, event.entity as OrgScoped);
  }

  afterUpdate(event: UpdateEvent<unknown>) {
    const target = event.metadata.target as object;
    if (!WATCHED.has(target)) return;
    const watched = WATCHED.get(target);
    const changed = [
      ...event.updatedColumns.map((c) => c.propertyName),
      ...event.updatedRelations.map((r) => r.propertyName),
    ];
    // Query-builder updates report no columns: treat as relevant.
    if (watched && changed.length && !changed.some((p) => watched.has(p))) {
      return;
    }
    return this.touch(
      event.queryRunner,
      event.entity as OrgScoped,
      event.databaseEntity as OrgScoped,
    );
  }

  afterRemove(event: RemoveEvent<unknown>) {
    if (!WATCHED.has(event.metadata.target as object)) return;
    return this.touch(
      event.queryRunner,
      event.entity as OrgScoped,
      event.databaseEntity as OrgScoped,
    );
  }

  afterSoftRemove(event: SoftRemoveEvent<unknown>) {
    if (!WATCHED.has(event.metadata.target as object)) return;
    return this.touch(
      event.queryRunner,
      event.entity as OrgScoped,
      event.databaseEntity as OrgScoped,
    );
  }

  async afterTransactionCommit(event: TransactionCommitEvent) {
    // A released savepoint is not the real commit.
    if (event.queryRunner.isTransactionActive) return;
    const pending = this.takePending(event.queryRunner);
    for (const orgId of pending) await this.versions.bumpQuietly(orgId);
  }

  afterTransactionRollback(event: TransactionRollbackEvent) {
    if (event.queryRunner.isTransactionActive) return;
    this.takePending(event.queryRunner);
  }

  private async touch(
    queryRunner: QueryRunner,
    entity: OrgScoped,
    databaseEntity?: OrgScoped,
  ) {
    const orgId = entity?.organizationId ?? databaseEntity?.organizationId;
    if (!orgId) return;
    if (queryRunner?.isTransactionActive) {
      const data = queryRunner.data as Record<string, unknown>;
      const pending =
        (data[PENDING_KEY] as Set<string> | undefined) ?? new Set();
      pending.add(orgId);
      data[PENDING_KEY] = pending;
      return;
    }
    await this.versions.bumpQuietly(orgId);
  }

  private takePending(queryRunner: QueryRunner): Set<string> {
    const data = (queryRunner.data ?? {}) as Record<string, unknown>;
    const pending =
      (data[PENDING_KEY] as Set<string> | undefined) ?? new Set<string>();
    delete data[PENDING_KEY];
    return pending;
  }
}
