import { PatientDevicesService } from './patient-devices.service';
import type { PatientDevice } from './patient-device.entity';

const DTO = {
  expoPushToken: 'ExponentPushToken[abc]',
  platform: 'android' as const,
  appVersion: '1.0.0',
  deviceLabel: 'Pixel 8',
};

function setup(existing: PatientDevice | null = null) {
  const query = jest.fn().mockResolvedValue([]);
  const repo = {
    manager: { query },
    findOneBy: jest.fn().mockResolvedValue(existing),
    create: jest.fn((v: unknown) => v),
    save: jest.fn((v: Record<string, unknown>) =>
      Promise.resolve({ id: 'dev-1', ...v }),
    ),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const service = new PatientDevicesService(repo as never);
  return { service, repo, query };
}

describe('PatientDevicesService', () => {
  it('registers a new token for the account', async () => {
    const { service, repo } = setup();
    await expect(service.register('acc-1', 'sess-1', DTO)).resolves.toEqual({
      id: 'dev-1',
    });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acc-1', sessionId: 'sess-1', expoPushToken: DTO.expoPushToken }),
    );
  });

  it('moves an existing token to the calling account (shared phone)', async () => {
    const row = { id: 'dev-9', accountId: 'acc-old' } as PatientDevice;
    const { service, repo } = setup(row);
    await expect(service.register('acc-2', 'sess-2', DTO)).resolves.toEqual({ id: 'dev-9' });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'dev-9', accountId: 'acc-2', sessionId: 'sess-2' }),
    );
  });

  it('unregister only deletes the caller\'s own token', async () => {
    const { service, repo } = setup();
    await expect(
      service.unregister('acc-1', DTO.expoPushToken),
    ).resolves.toEqual({ deleted: true });
    expect(repo.delete).toHaveBeenCalledWith({
      accountId: 'acc-1',
      expoPushToken: DTO.expoPushToken,
    });
  });

  it('finds phones only through an ACTIVE link of an approved clinic and a live account', async () => {
    const { service, query } = setup();
    query.mockResolvedValueOnce([{ expo_push_token: 'T1' }]);
    await expect(
      service.pushTokensForPatient('org-1', 'pat-1'),
    ).resolves.toEqual(['T1']);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("l.status = 'active'");
    expect(sql).toContain("o.approval_status = 'approved'");
    expect(sql).toContain('o.is_active');
    expect(sql).toContain("a.status = 'active'");
    expect(sql).toContain('a.deleted_at IS NULL');
    expect(sql).toContain('p.deleted_at IS NULL');
    expect(query.mock.calls[0][1]).toEqual(['org-1', ['pat-1']]);
  });

  it('patientsWithDevices asks for a device unless told not to', async () => {
    const { service, query } = setup();
    query.mockResolvedValue([{ patient_id: 'pat-1' }]);
    await expect(
      service.patientsWithDevices(
        { query } as never,
        'org-1',
        ['pat-1', 'pat-2'],
      ),
    ).resolves.toEqual(['pat-1']);
    expect(query.mock.calls[0][1]).toEqual(['org-1', ['pat-1', 'pat-2'], true]);
    // a suspended clinic never pushes
    expect(String(query.mock.calls[0][0])).toContain('o.is_active');

    await service.patientsWithDevices({ query } as never, 'org-1', ['pat-1'], false);
    expect(query.mock.calls[1][1]).toEqual(['org-1', ['pat-1'], false]);
  });

  it('patientsWithDevices short-circuits on an empty list', async () => {
    const { service, query } = setup();
    await expect(
      service.patientsWithDevices({ query } as never, 'org-1', []),
    ).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
