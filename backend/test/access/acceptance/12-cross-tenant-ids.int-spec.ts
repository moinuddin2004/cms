import { randomUUID } from 'crypto';
import { Employee } from 'src/employees/entities/employee.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { EmploymentRole } from 'src/employees/entities/employment-role.entity';
import { Supplier } from 'src/inventory/entities/supplier.entity';
import {
  InventoryItem,
  ItemUnit,
} from 'src/inventory/entities/inventory-item.entity';
import { DoctorSignature } from 'src/prescriptions/entities/doctor-signature.entity';
import { User } from 'src/user/entities/user.entity';
import { bearer, bootApp, dataOf, Env, seedWorld } from './harness';

/**
 * Section 12 — ids inside a request BODY (or another clinic's ids in the
 * URL) must never reach another clinic's rows. Every case is "OwnerA, acting
 * in clinic A with valid headers, names clinic B's rows" → refused, and
 * clinic B's data is unchanged / not returned.
 */
describe('AC-XT cross-tenant ids in requests', () => {
  let env: Env;
  let w: Env['world'];
  // Clinic B rows that clinic A's owner tries to reach.
  let ownerB: User;
  let empB: { employeeId: string; userId: string };
  let roleB: string;
  let supplierB: string;
  let itemA: string;

  beforeAll(async () => {
    env = await bootApp();
    w = await seedWorld(env, 'xt');
    const em = env.ds.manager;
    const tag = randomUUID().slice(0, 6);

    ownerB = await em
      .getRepository(User)
      .findOneByOrFail({ uuid: w.people.OwnerB.userId });

    // A doctor of clinic B with a login and a saved signature.
    const userB = await em.getRepository(User).save({
      email: `docb.${tag}@acceptance-it.test`,
      name: 'Doc B',
    } as Partial<User>);
    const employee = await em.getRepository(Employee).save({
      fullName: `Doc B ${tag}`,
      phone: `03${String(Date.now()).slice(-9)}`,
    } as Partial<Employee>);
    await em.getRepository(EmployeeOrgLocationAssignment).save({
      employeeId: employee.id,
      organizationId: w.orgB,
      locationId: w.LB1,
      designation: 'Doctor',
      employeeCode: `DB${tag}`,
      joiningDate: new Date('2024-01-01'),
      hasPortalAccess: true,
      userId: userB.uuid,
      createdBy: userB.uuid,
    } as Partial<EmployeeOrgLocationAssignment>);
    empB = { employeeId: employee.id, userId: userB.uuid };
    await em.getRepository(DoctorSignature).save({
      employeeId: employee.id,
      organizationId: w.orgB,
      signatureImageUrl: 'data:image/png;base64,iVBORw0KGgo=',
      isActive: true,
    } as Partial<DoctorSignature>);

    roleB = (
      await em.getRepository(EmploymentRole).findOneByOrFail({
        organizationId: w.orgB,
      })
    ).id;
    supplierB = (
      await em.getRepository(Supplier).save({
        organizationId: w.orgB,
        name: `Supplier B ${tag}`,
      } as Partial<Supplier>)
    ).id;
    itemA = (
      await em.getRepository(InventoryItem).save({
        organizationId: w.orgA,
        locationId: w.L1,
        name: `Gloves ${tag}`,
        unit: ItemUnit.BOXES,
        unitPrice: 100,
      } as Partial<InventoryItem>)
    ).id;
  }, 900_000);
  afterAll(async () => env?.close());

  const A = () => w.people.OwnerA;

  it('XT-01 account takeover: clinic A cannot change or delete an account that belongs to clinic B', async () => {
    // /user uses the real JWT strategy: sign a token for OwnerA.
    const auth = { headers: { Authorization: bearer(A()) } };
    // Step 1 (still possible): add clinic B's owner as a co-owner of clinic A.
    const add = await env.post(
      '/user',
      A(),
      { type: 'owner', email: ownerB.email, name: 'x' },
      auth,
    );
    expect([200, 201]).toContain(add.status);

    // Step 2 must fail: password, email, status, delete.
    for (const body of [
      { password: 'Hijack123!' },
      { email: `hijack.${randomUUID().slice(0, 6)}@evil.test` },
      { status: 'suspended' },
    ]) {
      const res = await env.patch(`/user/${ownerB.uuid}`, A(), body, auth);
      expect({ body, status: res.status }).toEqual({ body, status: 403 });
    }
    expect((await env.del(`/user/${ownerB.uuid}`, A(), auth)).status).toBe(403);

    const after = await env.ds
      .getRepository(User)
      .findOneByOrFail({ uuid: ownerB.uuid });
    expect(after.email).toBe(ownerB.email);
    expect(after.password).toBe(ownerB.password);
    expect(after.status).toBe(ownerB.status);
  });

  it('XT-02 employees: a userId in the body is refused; a clinic B role id is 404', async () => {
    const withUser = await env.post('/employees', A(), {
      fullName: 'Link Attempt',
      phone: `03${String(Date.now()).slice(-9)}`,
      designation: 'Assistant',
      userId: empB.userId,
    });
    expect(withUser.status).toBe(400);

    const withRole = await env.post('/employees', A(), {
      fullName: 'Role Attempt',
      phone: `03${String(Date.now() + 1).slice(-9)}`,
      designation: 'Assistant',
      employmentRoleId: roleB,
    });
    expect(withRole.status).toBe(404);
  });

  it('XT-03 prescriptions: clinic B patient / doctor in the body → 404, nothing of B returned', async () => {
    const patient = await env.post('/prescriptions', A(), {
      patientId: w.patients.PB,
    });
    expect(patient.status).toBe(404);
    expect(JSON.stringify(patient.body)).not.toContain(w.patients.PB);

    const doctor = await env.post('/prescriptions', A(), {
      patientId: w.patients.P1,
      doctorId: empB.employeeId,
    });
    expect(doctor.status).toBe(404);
  });

  it('XT-04 doctor signature: clinic B doctor signature is not readable from clinic A', async () => {
    const res = await env.get(`/doctor-signatures/doctor/${empB.employeeId}`, A());
    expect(res.status).toBe(200);
    expect(dataOf(res)).toBeNull();
  });

  it('XT-05 patient consumption: clinic B patient in the body → 404', async () => {
    const res = await env.post('/patient-consumptions', A(), {
      patientId: w.patients.PB,
      items: [{ inventoryItemId: itemA, quantity: 1, wasFromTemplate: false }],
    });
    expect(res.status).toBe(404);
  });

  it('XT-06 purchase order: clinic B supplier → 404', async () => {
    const res = await env.post('/purchase-orders', A(), {
      supplierId: supplierB,
      items: [{ inventoryItemId: itemA, orderedQuantity: 1, unitPrice: 10 }],
    });
    expect(res.status).toBe(404);
  });

  it('XT-07 payroll: clinic B employee → 404', async () => {
    const res = await env.post('/payroll', A(), {
      employeeId: empB.employeeId,
      month: 1,
      year: 2026,
      salaryAmount: 1000,
    });
    expect(res.status).toBe(404);
  });

  it('XT-08 patient credits: clinic B patient in the URL → 404', async () => {
    const res = await env.post(`/patients/${w.patients.PB}/credits`, A(), {
      creditPackageId: randomUUID(),
    });
    expect(res.status).toBe(404);
  });

  it('XT-09 a UUID spelled without hyphens cannot skip the patient-scope check', async () => {
    const compact = w.patients.PB.replace(/-/g, '');
    const res = await env.get(`/treatments?patientId=${compact}`, A());
    expect(res.status).toBe(400);
  });

  it('XT-10 uploads: unknown folder and a fake image are refused', async () => {
    const badFolder = await env
      .call('post', '/uploads?folder=../../etc', A())
      .attach('file', Buffer.from('%PDF-1.4 test'), 'x.pdf');
    expect(badFolder.status).toBe(400);

    const fakePng = await env
      .call('post', '/uploads?folder=branding', A())
      .attach('file', Buffer.from('<script>alert(1)</script>'), {
        filename: 'logo.png',
        contentType: 'image/png',
      });
    expect(fakePng.status).toBe(400);
  });
});
