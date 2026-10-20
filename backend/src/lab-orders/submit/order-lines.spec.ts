import type { FormDefinition } from 'src/engine/forms/form-definition.types';
import { UnitType } from 'src/lab-catalog/enums/catalog.enums';
import {
  appointmentWarning,
  estimateExpectedOn,
  extractTeeth,
  fileAnswerIds,
  lineQuantity,
  lineTotal,
  promotedColumns,
} from './order-lines';

const def: FormDefinition = {
  fields: [
    {
      key: 'teeth',
      type: 'tooth_chart',
      label: 'Teeth',
      roles: ['abutment', 'pontic'],
    },
    {
      key: 'shade',
      type: 'select',
      label: 'Shade',
      options: [{ value: 'A2', label: 'A2' }],
    },
    { key: 'scans', type: 'file', label: 'Scans' },
    { key: 'dia', type: 'number', label: 'Diameter' },
  ],
};

describe('order lines', () => {
  it('extracts one row per tooth with dentition, role and surfaces', () => {
    const rows = extractTeeth(def, {
      teeth: [
        { tooth: '14', role: 'abutment' },
        { tooth: '15', role: 'pontic', surfaces: ['M'] },
        { tooth: '14', role: 'pontic' },
        { tooth: '55', role: 'abutment' },
      ],
    });
    expect(rows).toEqual([
      {
        numberingSystem: 'FDI',
        toothCode: '14',
        dentition: 'permanent',
        toothRole: 'abutment',
        surfaces: [],
      },
      {
        numberingSystem: 'FDI',
        toothCode: '15',
        dentition: 'permanent',
        toothRole: 'pontic',
        surfaces: ['M'],
      },
      {
        numberingSystem: 'FDI',
        toothCode: '55',
        dentition: 'primary',
        toothRole: 'abutment',
        surfaces: [],
      },
    ]);
    expect(extractTeeth(def, {})).toEqual([]);
  });

  it('promotes only registered targets and skips empty answers', () => {
    expect(
      promotedColumns(
        {
          shade: 'dental_item_details.shade',
          dia: 'dental_item_details.implant_diameter_mm',
          scans: 'dental_item_details.not_a_column',
        },
        { shade: 'A2', dia: 4.1, scans: ['x'] },
      ),
    ).toEqual({
      dental_item_details: { shade: 'A2', implant_diameter_mm: 4.1 },
    });
    expect(
      promotedColumns({ shade: 'dental_item_details.shade' }, { shade: '' }),
    ).toEqual({});
    expect(promotedColumns(null, { shade: 'A2' })).toEqual({});
  });

  it('collects file answer ids', () => {
    expect(fileAnswerIds(def, { scans: ['a', 'b'], shade: 'A2' })).toEqual([
      'a',
      'b',
    ]);
  });

  it('per-tooth services bill the teeth count; others keep the quantity', () => {
    expect(lineQuantity(UnitType.PER_TOOTH, 1, 3)).toEqual({
      quantity: 3,
      issue: null,
    });
    expect(lineQuantity(UnitType.PER_TOOTH, 2, 0).issue).toMatch(/teeth/);
    expect(lineQuantity(UnitType.PER_CASE, 2, 5)).toEqual({
      quantity: 2,
      issue: null,
    });
    expect(lineTotal(670_000, 3)).toBe(2_010_000);
  });

  it('estimates the due day from the requested day or the longest turnaround', () => {
    expect(estimateExpectedOn('2026-10-20', [3, 7], null)).toBe('2026-10-27');
    expect(estimateExpectedOn('2026-10-20', [], null)).toBe('2026-10-20');
    expect(estimateExpectedOn('2026-10-20', [3], '2026-11-01')).toBe(
      '2026-11-01',
    );
  });

  it('warns only when the work is due after the next appointment', () => {
    const next = { id: 'a1', on: '2026-10-25' };
    expect(appointmentWarning('2026-10-27', next)).toMatchObject({
      code: 'LAB_DUE_AFTER_NEXT_APPOINTMENT',
      appointmentId: 'a1',
      appointmentOn: '2026-10-25',
      labExpectedOn: '2026-10-27',
    });
    expect(appointmentWarning('2026-10-25', next)).toBeNull();
    expect(appointmentWarning('2026-10-27', null)).toBeNull();
    expect(appointmentWarning(null, next)).toBeNull();
  });
});
