import { AccessContext } from 'src/access/access-context';
import {
  expandImplies,
  normalizeGrants,
  PermissionMap,
} from 'src/access/catalog/permissions';
import { BillingActor, toBillingActor } from './billing-context';

/** Unit-test AccessContext holding exactly `permissions` (implies expanded). */
export function testAccess(permissions: PermissionMap = {}): AccessContext {
  return new AccessContext({
    userId: 'user-1',
    organizationId: 'org-1',
    locationId: 'loc-1',
    version: 1,
    isSuperAdmin: false,
    isOwner: false,
    isMember: true,
    employeeId: 'emp-1',
    features: [],
    permissions: expandImplies(normalizeGrants(permissions)),
    roles: [{ id: 'role-1', name: 'Test role', templateKey: null }],
    homeRoute: null,
  });
}

export const testActor = (permissions: PermissionMap = {}): BillingActor =>
  toBillingActor(testAccess(permissions));
