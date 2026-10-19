import { FORM_SEEDS } from '../seeds/dental-forms.seed';
import { checkDefinition } from './form-definition.checker';
import { validateFormData } from './form-data.validator';
import type { FormDefinition } from './form-definition.types';

const seed = (code: string): FormDefinition => {
  const s = FORM_SEEDS.find((f) => f.code === code)!;
  return checkDefinition({ fields: s.fields }, s.ui, s.promotions).definition!;
};
const issueCodes = (r: ReturnType<typeof validateFormData>) =>
  r.issues.map((i) => `${i.path}:${i.code}`);

describe('form data validator', () => {
  const crown = seed('CROWN');
  const bridge = seed('BRIDGE');
  const denture = seed('DENTURE');
  const implant = seed('IMPLANT_CROWN');

  const crownAnswers = {
    teeth: [{ tooth: '16' }, { tooth: '26' }],
    material: 'zirconia_monolithic',
    shade_system: 'VITA_classical',
    shade: 'A2',
    impression_type: 'physical',
    notes: '  Match the adjacent 15  ',
  };

  it('accepts a complete crown order and normalises it', () => {
    const r = validateFormData(crown, crownAnswers);
    expect(r.issues).toEqual([]);
    expect(r.value).toEqual({
      teeth: [
        { tooth: '16', role: 'crown' },
        { tooth: '26', role: 'crown' },
      ],
      material: 'zirconia_monolithic',
      shade_system: 'VITA_classical',
      shade: 'A2',
      impression_type: 'physical',
      notes: 'Match the adjacent 15',
    });
  });

  it('reports every missing required field and unknown keys', () => {
    const r = validateFormData(crown, { colour: 'red' });
    expect(issueCodes(r)).toEqual([
      'colour:unknown_field',
      'teeth:required',
      'material:required',
      'shade_system:required',
      'impression_type:required',
    ]);
  });

  it('hidden fields are not required and are not stored', () => {
    // 3D-Master shade system hides `shade`, shows `shade_3d`.
    const r = validateFormData(crown, {
      ...crownAnswers,
      shade_system: 'VITA_3D_master',
      shade: 'A2',
    });
    expect(issueCodes(r)).toEqual(['shade_3d:required']);
    expect(r.value).not.toHaveProperty('shade');

    // A digital scan needs its files; a physical impression must not keep them.
    expect(
      issueCodes(
        validateFormData(crown, {
          ...crownAnswers,
          impression_type: 'digital_scan',
        }),
      ),
    ).toEqual(['scan_files:required']);
  });

  it('rejects invalid FDI teeth, duplicates and wrong roles', () => {
    const bad = (teeth: unknown) =>
      issueCodes(validateFormData(crown, { ...crownAnswers, teeth }));
    expect(bad([{ tooth: '19' }])).toEqual(['teeth:invalid_tooth']);
    expect(bad([{ tooth: '16' }, { tooth: '16' }])).toEqual([
      'teeth:duplicate',
    ]);
    expect(bad([{ tooth: '16', role: 'pontic' }])).toEqual([
      'teeth:invalid_role',
    ]);
    expect(bad([{ tooth: '16', surfaces: ['M'] }])).toEqual([
      'teeth:invalid_surfaces',
    ]);
    expect(bad('16')).toEqual(['teeth:invalid_type']);
  });

  it('a bridge needs 2 abutments, a pontic, and one arch (14–16 is valid)', () => {
    const answers = (teeth: unknown) => ({
      teeth,
      material: 'pfm',
      shade_system: 'VITA_classical',
      shade: 'A3',
      impression_type: 'physical',
    });
    const ok = validateFormData(
      bridge,
      answers([
        { tooth: '16', role: 'abutment' },
        { tooth: '15', role: 'pontic' },
        { tooth: '14', role: 'abutment' },
      ]),
    );
    expect(ok.issues).toEqual([]);
    expect((ok.value.teeth as { tooth: string }[]).map((t) => t.tooth)).toEqual(
      ['14', '15', '16'],
    );

    const oneAbutment = validateFormData(
      bridge,
      answers([
        { tooth: '16', role: 'abutment' },
        { tooth: '15', role: 'pontic' },
        { tooth: '14', role: 'pontic' },
      ]),
    );
    expect(issueCodes(oneAbutment)).toEqual(['teeth:role_count']);

    const twoArches = validateFormData(
      bridge,
      answers([
        { tooth: '16', role: 'abutment' },
        { tooth: '15', role: 'pontic' },
        { tooth: '46', role: 'abutment' },
      ]),
    );
    expect(issueCodes(twoArches)).toEqual(['teeth:mixed_arches']);
  });

  it('checks numbers against min, max and decimals', () => {
    const base = {
      teeth: [{ tooth: '36' }],
      implant_system: 'Straumann BLT',
      implant_platform: 'regular',
      abutment: 'ti_base',
      retention: 'screw_retained',
      material: 'zirconia_monolithic',
      shade_system: 'VITA_classical',
      shade: 'A2',
      impression_type: 'physical',
    };
    const d = (implant_diameter_mm: unknown) =>
      issueCodes(validateFormData(implant, { ...base, implant_diameter_mm }));
    expect(d(4.1)).toEqual([]);
    expect(d(4.15)).toEqual(['implant_diameter_mm:too_precise']);
    expect(d(9)).toEqual(['implant_diameter_mm:too_large']);
    expect(d('4.1')).toEqual(['implant_diameter_mm:invalid_type']);
    expect(
      issueCodes(
        validateFormData(implant, { ...base, teeth: [{ tooth: '75' }] }),
      ),
    ).toEqual(['teeth:invalid_tooth']);
  });

  it('a complete denture needs no teeth; a partial one does', () => {
    const base = { arch: 'upper', tooth_shade: 'A2' };
    expect(
      validateFormData(denture, { ...base, denture_type: 'complete' }).issues,
    ).toEqual([]);
    expect(
      issueCodes(
        validateFormData(denture, { ...base, denture_type: 'partial_cast' }),
      ),
    ).toEqual(['teeth:required']);
  });

  it('validates dates, booleans and file ids', () => {
    const def: FormDefinition = {
      fields: [
        { key: 'due', type: 'date', label: 'Due' },
        { key: 'rush', type: 'boolean', label: 'Rush' },
        { key: 'files', type: 'file', label: 'Files', maxFiles: 1 },
      ],
    };
    expect(
      issueCodes(
        validateFormData(def, {
          due: '2026-02-30',
          rush: 'yes',
          files: ['f6f0c3a4-8d8e-4b1a-9a59-2f3b8f7c9e10', 'nope'],
        }),
      ),
    ).toEqual(['due:invalid_date', 'rush:invalid_type', 'files:invalid_type']);
    expect(
      validateFormData(def, { due: '2026-02-28', rush: false }).value,
    ).toEqual({ due: '2026-02-28', rush: false });
  });

  it('rejects answers that are not an object', () => {
    expect(issueCodes(validateFormData(crown, ['x']))).toEqual([
      ':invalid_data',
    ]);
  });
});
