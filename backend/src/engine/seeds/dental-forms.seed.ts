import type {
  FieldDef,
  FieldOption,
  FormUi,
  Promotions,
} from '../forms/form-definition.types';

/**
 * Platform specialties and default form schemas (lab ERD §11 seed data).
 * `EngineSeedService` creates whatever is missing as published version 1;
 * it never changes existing forms. Later changes go through new versions.
 */

export interface SpecialtySeed {
  code: string;
  name: string;
  enabledByDefault: boolean;
}

export interface FormSeed {
  specialty: string;
  code: string;
  name: string;
  description: string;
  fields: FieldDef[];
  ui?: FormUi;
  promotions?: Promotions;
}

export const SPECIALTY_SEEDS: SpecialtySeed[] = [
  { code: 'DENTAL', name: 'Dental', enabledByDefault: true },
];

const opts = (pairs: [string, string][]): FieldOption[] =>
  pairs.map(([value, label]) => ({ value, label }));

const VITA_CLASSICAL = [
  'A1',
  'A2',
  'A3',
  'A3.5',
  'A4',
  'B1',
  'B2',
  'B3',
  'B4',
  'C1',
  'C2',
  'C3',
  'C4',
  'D2',
  'D3',
  'D4',
].map((s) => ({ value: s, label: s }));

const CROWN_MATERIALS = opts([
  ['zirconia_monolithic', 'Zirconia (monolithic)'],
  ['zirconia_layered', 'Zirconia (layered)'],
  ['emax', 'Lithium disilicate (e.max)'],
  ['pfm', 'Porcelain fused to metal (PFM)'],
  ['full_metal', 'Full metal'],
  ['pmma_temporary', 'PMMA (temporary)'],
]);

const shadeFields = (required: boolean): FieldDef[] => [
  {
    key: 'shade_system',
    type: 'select',
    label: 'Shade guide',
    options: opts([
      ['VITA_classical', 'VITA classical'],
      ['VITA_3D_master', 'VITA 3D-Master'],
    ]),
    defaultValue: 'VITA_classical',
    required,
  },
  {
    key: 'shade',
    type: 'select',
    label: 'Shade',
    options: VITA_CLASSICAL,
    required,
    visibleIf: { field: 'shade_system', in: ['VITA_classical'] },
  },
  {
    key: 'shade_3d',
    type: 'text',
    label: 'Shade (3D-Master)',
    maxLength: 10,
    required,
    visibleIf: { field: 'shade_system', in: ['VITA_3D_master'] },
  },
];

const impressionFields: FieldDef[] = [
  {
    key: 'impression_type',
    type: 'select',
    label: 'Impression',
    options: opts([
      ['physical', 'Physical impression / model'],
      ['digital_scan', 'Digital scan'],
    ]),
    required: true,
  },
  {
    key: 'scan_files',
    type: 'file',
    label: 'Scan files',
    help: 'STL / PLY from the intraoral scanner.',
    maxFiles: 10,
    accept: ['model/stl', 'application/sla', 'application/octet-stream'],
    required: true,
    visibleIf: { field: 'impression_type', in: ['digital_scan'] },
  },
];

const notes: FieldDef = {
  key: 'notes',
  type: 'textarea',
  label: 'Instructions for the lab',
  maxLength: 2000,
};

const SHADE_PROMOTIONS: Promotions = {
  shade_system: 'dental_item_details.shade_system',
  shade: 'dental_item_details.shade',
};

export const FORM_SEEDS: FormSeed[] = [
  {
    specialty: 'DENTAL',
    code: 'CROWN',
    name: 'Crown',
    description: 'Single-unit crowns on natural teeth.',
    fields: [
      {
        key: 'teeth',
        type: 'tooth_chart',
        label: 'Teeth',
        roles: ['crown'],
        minTeeth: 1,
        required: true,
      },
      {
        key: 'material',
        type: 'select',
        label: 'Material',
        options: CROWN_MATERIALS,
        required: true,
      },
      ...shadeFields(true),
      {
        key: 'margin_type',
        type: 'select',
        label: 'Margin',
        options: opts([
          ['chamfer', 'Chamfer'],
          ['shoulder', 'Shoulder'],
          ['knife_edge', 'Knife edge'],
          ['feather', 'Feather edge'],
        ]),
      },
      ...impressionFields,
      notes,
    ],
    ui: {
      sections: [
        { title: 'Teeth', fields: ['teeth'] },
        {
          title: 'Restoration',
          fields: [
            'material',
            'shade_system',
            'shade',
            'shade_3d',
            'margin_type',
          ],
        },
        { title: 'Impression', fields: ['impression_type', 'scan_files'] },
        { title: 'Notes', fields: ['notes'] },
      ],
    },
    promotions: {
      ...SHADE_PROMOTIONS,
      material: 'dental_item_details.material_code',
      margin_type: 'dental_item_details.margin_type',
    },
  },
  {
    specialty: 'DENTAL',
    code: 'BRIDGE',
    name: 'Bridge',
    description: 'Fixed bridge: abutments plus pontics in one arch.',
    fields: [
      {
        key: 'teeth',
        type: 'tooth_chart',
        label: 'Teeth',
        help: 'Mark each tooth as an abutment or a pontic.',
        roles: ['abutment', 'pontic'],
        minTeeth: 3,
        maxTeeth: 16,
        minPerRole: { abutment: 2, pontic: 1 },
        sameArch: true,
        dentition: 'permanent',
        required: true,
      },
      {
        key: 'material',
        type: 'select',
        label: 'Material',
        options: CROWN_MATERIALS.filter((o) => o.value !== 'emax'),
        required: true,
      },
      ...shadeFields(true),
      {
        key: 'pontic_design',
        type: 'select',
        label: 'Pontic design',
        options: opts([
          ['ridge_lap', 'Ridge lap'],
          ['modified_ridge_lap', 'Modified ridge lap'],
          ['ovate', 'Ovate'],
          ['sanitary', 'Sanitary (hygienic)'],
        ]),
      },
      ...impressionFields,
      notes,
    ],
    promotions: {
      ...SHADE_PROMOTIONS,
      material: 'dental_item_details.material_code',
    },
  },
  {
    specialty: 'DENTAL',
    code: 'IMPLANT_CROWN',
    name: 'Implant crown',
    description: 'Crown on an implant, screw- or cement-retained.',
    fields: [
      {
        key: 'teeth',
        type: 'tooth_chart',
        label: 'Implant sites',
        roles: ['implant'],
        minTeeth: 1,
        dentition: 'permanent',
        required: true,
      },
      {
        key: 'implant_system',
        type: 'text',
        label: 'Implant system',
        help: 'Brand and line, e.g. Straumann BLT.',
        maxLength: 100,
        required: true,
      },
      {
        key: 'implant_platform',
        type: 'select',
        label: 'Platform',
        options: opts([
          ['narrow', 'Narrow'],
          ['regular', 'Regular'],
          ['wide', 'Wide'],
        ]),
        required: true,
      },
      {
        key: 'implant_diameter_mm',
        type: 'number',
        label: 'Implant diameter',
        unit: 'mm',
        min: 2.5,
        max: 7,
        decimals: 1,
      },
      {
        key: 'abutment',
        type: 'select',
        label: 'Abutment',
        options: opts([
          ['stock', 'Stock'],
          ['custom', 'Custom'],
          ['ti_base', 'Ti-base'],
        ]),
        required: true,
      },
      {
        key: 'retention',
        type: 'select',
        label: 'Retention',
        options: opts([
          ['screw_retained', 'Screw-retained'],
          ['cement_retained', 'Cement-retained'],
        ]),
        required: true,
      },
      {
        key: 'material',
        type: 'select',
        label: 'Crown material',
        options: CROWN_MATERIALS,
        required: true,
      },
      ...shadeFields(true),
      ...impressionFields,
      notes,
    ],
    promotions: {
      ...SHADE_PROMOTIONS,
      material: 'dental_item_details.material_code',
      implant_system: 'dental_item_details.implant_system',
      implant_platform: 'dental_item_details.implant_platform',
      implant_diameter_mm: 'dental_item_details.implant_diameter_mm',
    },
  },
  {
    specialty: 'DENTAL',
    code: 'DENTURE',
    name: 'Denture',
    description: 'Complete or partial removable dentures.',
    fields: [
      {
        key: 'arch',
        type: 'select',
        label: 'Arch',
        options: opts([
          ['upper', 'Upper'],
          ['lower', 'Lower'],
          ['both', 'Upper and lower'],
        ]),
        required: true,
      },
      {
        key: 'denture_type',
        type: 'select',
        label: 'Type',
        options: opts([
          ['complete', 'Complete'],
          ['partial_acrylic', 'Partial — acrylic'],
          ['partial_cast', 'Partial — cast metal'],
          ['partial_flexible', 'Partial — flexible'],
        ]),
        required: true,
      },
      {
        key: 'teeth',
        type: 'tooth_chart',
        label: 'Teeth to replace',
        roles: ['pontic'],
        minTeeth: 1,
        dentition: 'permanent',
        required: true,
        visibleIf: {
          field: 'denture_type',
          in: ['partial_acrylic', 'partial_cast', 'partial_flexible'],
        },
      },
      {
        key: 'tooth_shade',
        type: 'select',
        label: 'Tooth shade',
        options: VITA_CLASSICAL,
        required: true,
      },
      {
        key: 'gum_shade',
        type: 'select',
        label: 'Gum shade',
        options: opts([
          ['light', 'Light pink'],
          ['standard', 'Standard pink'],
          ['dark', 'Dark / veined'],
        ]),
      },
      notes,
    ],
    promotions: { tooth_shade: 'dental_item_details.shade' },
  },
  {
    specialty: 'DENTAL',
    code: 'REPAIR',
    name: 'Repair',
    description: 'Repair or adjustment of an existing appliance.',
    fields: [
      {
        key: 'appliance',
        type: 'select',
        label: 'What needs repair',
        options: opts([
          ['crown_bridge', 'Crown / bridge'],
          ['denture', 'Denture'],
          ['night_guard', 'Night guard / splint'],
          ['retainer', 'Retainer'],
          ['other', 'Other'],
        ]),
        required: true,
      },
      {
        key: 'problem',
        type: 'textarea',
        label: 'What is wrong',
        maxLength: 2000,
        required: true,
      },
      {
        key: 'teeth',
        type: 'tooth_chart',
        label: 'Teeth involved',
        roles: ['crown', 'pontic'],
      },
      {
        key: 'add_teeth',
        type: 'boolean',
        label: 'Add teeth to the appliance',
        defaultValue: false,
      },
      notes,
    ],
  },
];
