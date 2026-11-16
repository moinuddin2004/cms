import type { PatientLink } from '../types/clinics.types';
import { splitLinks } from './split-links';

const link = (id: string, status: PatientLink['status'], linkedAt: string, revokedAt: string | null = null): PatientLink => ({
  id,
  profileId: 'p',
  clinic: { organizationId: 'o', name: 'C', logoUrl: null, brandColor: null, clinicStatus: 'active' },
  location: null,
  status,
  linkedAt,
  linkMethod: 'staff_qr',
  linkedByLabel: 'Clinic QR',
  revokedAt,
  revokedBy: revokedAt ? 'patient' : null,
});

describe('splitLinks', () => {
  it('separates live from revoked and orders each newest first', () => {
    const { current, past } = splitLinks([
      link('old', 'active', '2026-01-01T00:00:00Z'),
      link('gone1', 'revoked', '2026-01-01T00:00:00Z', '2026-03-01T00:00:00Z'),
      link('new', 'frozen', '2026-06-01T00:00:00Z'),
      link('gone2', 'revoked', '2025-01-01T00:00:00Z', '2026-05-01T00:00:00Z'),
    ]);
    expect(current.map((l) => l.id)).toEqual(['new', 'old']);
    expect(past.map((l) => l.id)).toEqual(['gone2', 'gone1']);
  });

  it('handles an empty list', () => {
    expect(splitLinks([])).toEqual({ current: [], past: [] });
  });
});
