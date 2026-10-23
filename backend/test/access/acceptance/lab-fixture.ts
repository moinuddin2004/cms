import { randomUUID } from 'crypto';
import { IsNull } from 'typeorm';
import { localDate } from 'src/common/clock/tz.util';
import { User } from 'src/user/entities/user.entity';
import { FormSchema } from 'src/engine/entities/form-schema.entity';
import { WorkflowTemplate } from 'src/engine/entities/workflow-template.entity';
import { ServiceCategory } from 'src/lab-catalog/entities/service-category.entity';
import { dataOf, Env, Person } from './harness';

export interface LabSeed {
  labId: string;
  serviceId: string;
  linkId: string;
  /** A user that is `lab_admin` of the lab (portal side). */
  labAdmin: Person;
  /** Draft lab orders: Doc1's (for P1) and Doc2's (for P2). */
  orders: { doc1: string; doc2: string };
}

/**
 * A lab with one service and price, linked and activated for OrgA, plus one
 * draft order per doctor — built through the real platform / clinic APIs.
 */
export async function seedLab(env: Env): Promise<LabSeed> {
  const w = env.world;
  const sa = w.people.SA;
  const platform = (
    method: 'post' | 'get',
    url: string,
    body?: object,
  ) => env.call(method, url, sa, { body, org: null, loc: null });
  const m = env.ds.manager;
  const platformDef = { organizationId: IsNull() };
  const crownForm = await m
    .getRepository(FormSchema)
    .findOneByOrFail({ ...platformDef, code: 'CROWN' });
  const itemWorkflow = await m
    .getRepository(WorkflowTemplate)
    .findOneByOrFail({ ...platformDef, code: 'DENTAL_ITEM' });
  const category = await m
    .getRepository(ServiceCategory)
    .findOneByOrFail({ code: 'CROWN' });

  const lab = dataOf<{ id: string }>(
    await platform('post', '/platform/labs', {
      name: `Acceptance Lab ${randomUUID().slice(0, 6)}`,
      labType: 'external',
      city: 'Lahore',
    }).expect(201),
  );

  const email = `lab-admin.${randomUUID().slice(0, 8)}@acceptance-it.test`;
  const labAdminUser = await m.getRepository(User).save({
    email,
    name: 'Lab admin',
  } as Partial<User>);
  await platform('post', `/platform/labs/${lab.id}/members`, {
    email,
    role: 'lab_admin',
  }).expect(201);

  const service = dataOf<{ id: string }>(
    await platform('post', `/platform/labs/${lab.id}/services`, {
      categoryId: category.id,
      code: 'zr_crown',
      name: 'Zirconia crown',
      unitType: 'per_tooth',
      defaultTurnaroundDays: 5,
      formSchemaId: crownForm.id,
      workflowTemplateId: itemWorkflow.id,
    }).expect(201),
  );
  await platform('post', `/platform/labs/${lab.id}/services/${service.id}/prices`, {
    unitPricePaisa: 500_000,
    effectiveFrom: localDate('Asia/Karachi', new Date()),
  }).expect(201);

  const owner = w.people.OwnerA;
  const link = dataOf<{ id: string }>(
    await env.post('/lab-links', owner, { labId: lab.id }).expect(201),
  );
  await env
    .post(`/lab-links/${link.id}/transitions`, owner, {
      action: 'activate',
      version: 1,
    })
    .expect(201);

  const draft = async (doctor: Person, patientId: string) =>
    dataOf<{ id: string }>(
      await env
        .post('/lab-orders', doctor, {
          patientId,
          labId: lab.id,
          items: [{ labServiceId: service.id, answers: { material: 'emax' } }],
        })
        .expect(201),
    ).id;
  const doc1 = await draft(w.people.Doc1, w.patients.P1);
  const doc2 = await draft(w.people.Doc2, w.patients.P2);

  return {
    labId: lab.id,
    serviceId: service.id,
    linkId: link.id,
    labAdmin: {
      userId: labAdminUser.uuid,
      employeeId: null,
      assignmentId: null,
      orgId: w.orgA,
      locId: w.L1,
    },
    orders: { doc1, doc2 },
  };
}
