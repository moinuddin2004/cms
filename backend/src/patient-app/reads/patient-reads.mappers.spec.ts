import {
  mapAppointment,
  mapInvoice,
  mapPrescription,
  mapPrescriptionDetail,
  mapVisit,
} from './patient-reads.mappers';
import type { ClinicRefDto } from './patient-reads.types';

/**
 * DTO snapshot tests (M2-08 acceptance): each mapper is fed a row polluted
 * with internal fields; the output must hold exactly the allow-listed keys.
 */

const clinic: ClinicRefDto = {
  organizationId: 'org-1',
  name: 'Smile Clinic',
  logoUrl: null,
  brandColor: '#0f766e',
  clinicStatus: 'active',
};

const location = {
  locationId: 'loc-1',
  locationName: 'Main',
  locationTimezone: 'Asia/Karachi',
  locationPhone: '+92 300 0000000',
  locationAddress: '1 Clinic Road',
};

/** Fields that must never reach a patient. */
const INTERNAL = {
  organizationId: 'org-1',
  patientId: 'pat-1',
  notes: 'internal staff note',
  cost: 5000,
  commission: 10,
  createdBy: 'user-9',
  updatedBy: 'user-9',
  cancelReason: 'internal',
  reasonForVisit: 'secret',
  examination: 'clinical note',
  chiefComplaint: 'clinical note',
  advice: 'clinical note',
  signatureImageUrl: 'https://x/sig.png',
  vitals: { bp: '120/80' },
  doctorId: 'emp-1',
  issuedBy: 'user-3',
  taxAmount: 1,
  discountTotal: 2,
};

const sorted = (o: object) => Object.keys(o).sort();

describe('patient read DTOs expose only allow-listed fields', () => {
  it('appointment', () => {
    const dto = mapAppointment(
      {
        ...INTERNAL,
        ...location,
        id: 'a-1',
        doctorName: 'Dr Ayesha',
        startTime: new Date('2026-12-01T09:00:00Z'),
        endTime: '2026-12-01T09:30:00Z',
        status: 'scheduled',
        type: 'consultation',
      },
      'prof-1',
      clinic,
    );
    expect(dto).toEqual({
      id: 'a-1',
      profileId: 'prof-1',
      clinic,
      location: {
        id: 'loc-1',
        name: 'Main',
        timezone: 'Asia/Karachi',
        phone: '+92 300 0000000',
        whatsapp: null,
        address: '1 Clinic Road',
      },
      doctorName: 'Dr Ayesha',
      startTime: '2026-12-01T09:00:00.000Z',
      endTime: '2026-12-01T09:30:00.000Z',
      status: 'scheduled',
      type: 'consultation',
      patientConfirmedAt: null,
      canConfirm: false,
    });
    expect(sorted(dto)).toEqual(
      [
        'canConfirm',
        'clinic',
        'doctorName',
        'endTime',
        'id',
        'location',
        'patientConfirmedAt',
        'profileId',
        'startTime',
        'status',
        'type',
      ].sort(),
    );
  });

  const visitRow = {
    ...INTERNAL,
    ...location,
    id: 'v-1',
    visitDate: '2026-11-10',
    doctorName: 'Dr Ayesha',
    followUpDate: '2026-11-24',
    diagnosis: 'Caries',
    treatments: ['Filling'],
  };

  it('visit with diagnosis on', () => {
    const dto = mapVisit(visitRow, 'prof-1', clinic, true);
    expect(dto).toEqual({
      id: 'v-1',
      profileId: 'prof-1',
      clinic,
      location: expect.objectContaining({ timezone: 'Asia/Karachi' }),
      date: '2026-11-10',
      doctorName: 'Dr Ayesha',
      followUpDate: '2026-11-24',
      diagnosis: 'Caries',
      treatments: ['Filling'],
    });
  });

  it('visit with diagnosis off has no diagnosis/treatments keys at all', () => {
    const dto = mapVisit(visitRow, 'prof-1', clinic, false);
    expect(sorted(dto)).toEqual(
      [
        'clinic',
        'date',
        'doctorName',
        'followUpDate',
        'id',
        'location',
        'profileId',
      ].sort(),
    );
    expect(JSON.stringify(dto)).not.toMatch(/Caries|Filling|diagnosis/);
  });

  const rxRow = {
    ...INTERNAL,
    ...location,
    id: 'rx-1',
    doctorName: 'Dr Ayesha',
    number: 'RX-0001',
    signedAt: '2026-11-10T08:00:00Z',
    medicinesCount: '2',
    pdfUrl: 'https://files/rx-1.pdf',
  };

  it('prescription list item', () => {
    const dto = mapPrescription(rxRow, 'prof-1', clinic, true);
    expect(sorted(dto)).toEqual(
      [
        'clinic',
        'doctorName',
        'hasPdf',
        'id',
        'issuedAt',
        'location',
        'medicinesCount',
        'number',
        'profileId',
      ].sort(),
    );
    expect(dto.medicinesCount).toBe(2);
    expect(dto.hasPdf).toBe(true);
    expect(dto.issuedAt).toBe('2026-11-10T08:00:00.000Z');
    expect(mapPrescription(rxRow, 'p', clinic, false).hasPdf).toBe(false);
    expect(JSON.stringify(dto)).not.toContain('files/rx-1');
  });

  it('prescription detail medicines', () => {
    const dto = mapPrescriptionDetail(
      rxRow,
      [
        {
          ...INTERNAL,
          medicineName: 'Amoxicillin',
          medicineNameUrdu: null,
          type: 'CAPSULE',
          dosage: '500mg',
          frequency: 'TDS',
          frequencyTiming: ['morning', 'night'],
          mealRelation: 'AFTER_MEAL',
          duration: '5 days',
          specialInstructions: 'finish the course',
          specialInstructionsUrdu: null,
        } as never,
      ],
      'prof-1',
      clinic,
      true,
    );
    // a stored public URL on the row must never reach the app
    expect(dto).not.toHaveProperty('pdfUrl');
    expect(JSON.stringify(dto)).not.toContain('files/rx-1');
    expect(dto.medicines).toEqual([
      {
        name: 'Amoxicillin',
        nameUrdu: null,
        type: 'CAPSULE',
        dosage: '500mg',
        frequency: 'TDS',
        frequencyTiming: ['morning', 'night'],
        mealRelation: 'AFTER_MEAL',
        duration: '5 days',
        instructions: 'finish the course',
        instructionsUrdu: null,
      },
    ]);
    expect(JSON.stringify(dto)).not.toMatch(/sig\.png|vitals|clinical note/);
  });

  it('invoice: minor units + payment status; no staff/tax internals', () => {
    const row = {
      ...INTERNAL,
      id: 'i-1',
      invoiceNumber: 'INV-1',
      issuedAt: '2026-11-01T05:00:00Z',
      dueDate: '2026-11-15',
      totalAmount: '1500.50',
      paidAmount: 500,
      balanceDue: '1000.50',
      locationTimezone: 'Asia/Karachi',
    };
    const dto = mapInvoice(row, 'prof-1', '2026-11-10');
    expect(dto).toEqual({
      id: 'i-1',
      profileId: 'prof-1',
      number: 'INV-1',
      issuedAt: '2026-11-01T05:00:00.000Z',
      totalMinor: 150050,
      paidMinor: 50000,
      balanceMinor: 100050,
      status: 'partial',
    });
    expect(mapInvoice(row, 'p', '2026-11-16').status).toBe('overdue');
    expect(
      mapInvoice({ ...row, paidAmount: 0 }, 'p', '2026-11-10').status,
    ).toBe('unpaid');
    expect(
      mapInvoice(
        { ...row, paidAmount: 1500.5, balanceDue: 0 },
        'p',
        '2030-01-01',
      ).status,
    ).toBe('paid');
  });
});
