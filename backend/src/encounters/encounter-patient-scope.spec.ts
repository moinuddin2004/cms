import { NotFoundException } from '@nestjs/common';
import type { AccessContext } from 'src/access/access-context';
import { isPatientInScope } from 'src/patients/access/patient-scope';
import { EncountersService } from './encounters.service';

jest.mock('src/patients/access/patient-scope', () => ({
  isPatientInScope: jest.fn(),
}));

const ctx = { organizationId: 'org', locationId: 'loc' };
const access = {} as AccessContext;

function service(found: { id: string; patientId: string } | null) {
  const repo = {
    findOne: jest.fn().mockResolvedValue(found),
    manager: { connection: { tag: 'ds' } },
  };
  return { svc: new EncountersService(repo as never), repo };
}

describe('EncountersService.assertPatientInScope', () => {
  beforeEach(() => jest.mocked(isPatientInScope).mockReset());

  it('passes when the encounter patient is inside the caller patients.view scope', async () => {
    jest.mocked(isPatientInScope).mockResolvedValue(true);
    const { svc } = service({ id: 'e1', patientId: 'p1' });
    await expect(svc.assertPatientInScope('e1', ctx, access)).resolves.toBeUndefined();
    expect(isPatientInScope).toHaveBeenCalledWith({ tag: 'ds' }, access, 'p1');
  });

  it('reads as not found when the patient is outside the scope', async () => {
    jest.mocked(isPatientInScope).mockResolvedValue(false);
    const { svc } = service({ id: 'e1', patientId: 'p2' });
    await expect(svc.assertPatientInScope('e1', ctx, access)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('is not found for an unknown encounter, without checking the scope', async () => {
    const { svc, repo } = service(null);
    await expect(svc.assertPatientInScope('nope', ctx, access)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(isPatientInScope).not.toHaveBeenCalled();
    expect(repo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'nope', organizationId: 'org', locationId: 'loc' },
      }),
    );
  });
});
