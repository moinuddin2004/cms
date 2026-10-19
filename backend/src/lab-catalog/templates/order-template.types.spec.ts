import type { FormDefinition } from 'src/engine/forms/form-definition.types';
import { validateTemplateAnswers } from './order-template.types';

const CROWN: FormDefinition = {
  fields: [
    { key: 'teeth', type: 'tooth_chart', label: 'Teeth', required: true },
    {
      key: 'material',
      type: 'select',
      label: 'Material',
      required: true,
      options: [
        { value: 'zirconia', label: 'Zirconia' },
        { value: 'emax', label: 'Emax' },
      ],
    },
    { key: 'shade', type: 'text', label: 'Shade', required: true },
    { key: 'notes', type: 'textarea', label: 'Notes' },
  ],
} as FormDefinition;

describe('validateTemplateAnswers', () => {
  it('accepts a partial pre-fill — required answers are left for the order', () => {
    const r = validateTemplateAnswers(CROWN, { material: 'zirconia' });
    expect(r.issues).toEqual([]);
    expect(r.value).toEqual({ material: 'zirconia' });
  });

  it('accepts an empty pre-fill', () => {
    expect(validateTemplateAnswers(CROWN, {}).issues).toEqual([]);
  });

  it('refuses unknown fields and invalid answers', () => {
    const r = validateTemplateAnswers(CROWN, {
      material: 'gold',
      colour: 'A2',
    });
    const codes = r.issues.map((i) => `${i.path}:${i.code}`).sort();
    expect(codes).toHaveLength(2);
    expect(codes[0]).toMatch(/^colour:unknown_field$/);
    expect(codes[1]).toMatch(/^material:/);
  });

  it('stores answers normalised (trimmed)', () => {
    const r = validateTemplateAnswers(CROWN, { shade: '  A2 ' });
    expect(r.issues).toEqual([]);
    expect(r.value).toEqual({ shade: 'A2' });
  });
});
