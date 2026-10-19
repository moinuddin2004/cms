import { FORM_SEEDS } from '../seeds/dental-forms.seed';
import { checkDefinition } from './form-definition.checker';

const codes = (r: ReturnType<typeof checkDefinition>) =>
  r.issues.map((i) => `${i.path}:${i.code}`);

const field = (over: Record<string, unknown> = {}) => ({
  key: 'notes',
  type: 'text',
  label: 'Notes',
  ...over,
});

describe('form definition checker', () => {
  it.each(FORM_SEEDS.map((s) => [s.code, s] as const))(
    'seed form %s is publishable',
    (_code, seed) => {
      const r = checkDefinition(
        { fields: seed.fields },
        seed.ui,
        seed.promotions,
      );
      expect(r.issues).toEqual([]);
    },
  );

  it('needs a fields array with at least one field', () => {
    expect(codes(checkDefinition(null, null, null))).toEqual([
      'fields:invalid_schema',
    ]);
    expect(codes(checkDefinition({ fields: [] }, null, null))).toEqual([
      'fields:no_fields',
    ]);
  });

  it('rejects bad and duplicate keys, unknown types and properties', () => {
    const r = checkDefinition(
      {
        fields: [
          field({ key: 'Bad Key' }),
          field(),
          field(),
          field({ key: 'x', type: 'colour' }),
          field({ key: 'y', requried: true }),
        ],
      },
      null,
      null,
    );
    expect(codes(r)).toEqual([
      'fields[0].key:invalid_key',
      'notes.key:duplicate_key',
      'x.type:unknown_type',
      'y.requried:unknown_property',
    ]);
  });

  it('expands string options and checks them', () => {
    const r = checkDefinition(
      {
        fields: [
          {
            key: 'shade',
            type: 'select',
            label: 'Shade',
            options: ['A1', 'A2'],
          },
          { key: 'dup', type: 'select', label: 'Dup', options: ['A', 'A'] },
          {
            key: 'def',
            type: 'select',
            label: 'D',
            options: ['A'],
            defaultValue: 'B',
          },
        ],
      },
      null,
      null,
    );
    expect(codes(r)).toEqual([
      'dup.options:duplicate_option',
      'def.defaultValue:invalid_default',
    ]);
    expect(r.definition?.fields[0]).toMatchObject({
      options: [
        { value: 'A1', label: 'A1' },
        { value: 'A2', label: 'A2' },
      ],
    });
  });

  it('visibleIf must point backwards at a choice field with real values', () => {
    const r = checkDefinition(
      {
        fields: [
          field({ key: 'a', visibleIf: { field: 'kind', in: ['x'] } }),
          { key: 'kind', type: 'select', label: 'Kind', options: ['x', 'y'] },
          field({ key: 'b', visibleIf: { field: 'kind', in: ['z'] } }),
          field({ key: 'c', visibleIf: { field: 'a', in: ['x'] } }),
          field({ key: 'd', visibleIf: { field: 'kind', in: ['y'] } }),
        ],
      },
      null,
      null,
    );
    expect(codes(r)).toEqual([
      'a.visibleIf:invalid_condition',
      'b.visibleIf:invalid_condition',
      'c.visibleIf:invalid_condition',
    ]);
  });

  it('checks number limits and tooth chart settings', () => {
    const r = checkDefinition(
      {
        fields: [
          { key: 'n', type: 'number', label: 'N', min: 5, max: 1, decimals: 9 },
          {
            key: 't',
            type: 'tooth_chart',
            label: 'T',
            roles: ['crown', 'wing'],
            minTeeth: 4,
            maxTeeth: 2,
          },
          {
            key: 't2',
            type: 'tooth_chart',
            label: 'T2',
            numbering: 'UNIVERSAL',
          },
        ],
      },
      null,
      null,
    );
    expect(codes(r)).toEqual([
      'n.min:invalid_limit',
      'n.decimals:invalid_limit',
      't.roles:invalid_roles',
      't.minTeeth:invalid_limit',
      't2.numbering:invalid_numbering',
      'fields:multiple_tooth_charts',
    ]);
  });

  it('layout may only name existing fields, once', () => {
    const r = checkDefinition(
      { fields: [field()] },
      {
        sections: [
          { title: 'A', fields: ['notes', 'ghost'] },
          { title: 'B', fields: ['notes'] },
        ],
      },
      null,
    );
    expect(codes(r)).toEqual([
      'ui.sections[0]:unknown_field',
      'ui.sections[1]:duplicate_field',
    ]);
  });

  it('promotions target registered, type-compatible columns, each once', () => {
    const r = checkDefinition(
      {
        fields: [
          { key: 'shade', type: 'select', label: 'S', options: ['A1'] },
          { key: 'shade2', type: 'text', label: 'S2' },
          { key: 'flag', type: 'boolean', label: 'F' },
        ],
      },
      null,
      {
        shade: 'dental_item_details.shade',
        shade2: 'dental_item_details.shade',
        flag: 'dental_item_details.implant_diameter_mm',
        ghost: 'dental_item_details.shade_system',
        notes: 'patients.full_name',
      },
    );
    expect(codes(r)).toEqual([
      'promotions.shade2:duplicate_column',
      'promotions.flag:incompatible_column',
      'promotions.ghost:unknown_field',
      'promotions.notes:unknown_field',
    ]);
    expect(r.promotions).toEqual({ shade: 'dental_item_details.shade' });
  });
});
