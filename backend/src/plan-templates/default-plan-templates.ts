import { PlanTemplateCategory } from './enums/plan-template-category.enum';
import type { PlanTemplateItem } from './entities/plan-template.entity';

interface DefaultTemplate {
  name: string;
  category: PlanTemplateCategory;
  description: string;
  items: [name: string, sessions: number, notes?: string][];
}

const toItems = (items: DefaultTemplate['items']): PlanTemplateItem[] =>
  items.map(([procedureName, estimatedSessions, notes]) => ({
    procedureName,
    estimatedSessions,
    serviceId: null,
    notes: notes ?? null,
  }));

/**
 * The plans every clinic starts with. Steps are not linked to services yet —
 * each clinic has its own catalog; link them once on the Treatment Plan
 * Templates page (prices then always come from the catalog).
 */
const DEFAULTS: DefaultTemplate[] = [
  {
    name: 'Root Canal Treatment (RCT)',
    category: PlanTemplateCategory.ENDODONTICS,
    description: 'Complete root canal with final restoration.',
    items: [
      ['Diagnosis & IOPA X-ray', 1],
      ['Access opening & pulp removal', 1],
      ['Cleaning & shaping of canals', 2],
      ['Obturation (canal filling)', 1],
      ['Post-endodontic restoration / build-up', 1],
      ['Crown', 2, 'Impression and cementation'],
    ],
  },
  {
    name: 'Scaling & Polishing',
    category: PlanTemplateCategory.PREVENTIVE,
    description: 'Full-mouth cleaning.',
    items: [
      ['Ultrasonic scaling', 1],
      ['Polishing & fluoride application', 1],
    ],
  },
  {
    name: 'Gum Treatment (Periodontal)',
    category: PlanTemplateCategory.PERIODONTICS,
    description: 'Deep cleaning for gum disease.',
    items: [
      ['Deep scaling & root planing', 2],
      ['Re-evaluation', 1],
      ['Maintenance cleaning', 1],
    ],
  },
  {
    name: 'Composite Filling',
    category: PlanTemplateCategory.RESTORATIVE,
    description: 'Tooth-coloured filling for a cavity.',
    items: [['Composite filling', 1]],
  },
  {
    name: 'Simple Extraction',
    category: PlanTemplateCategory.ORAL_SURGERY,
    description: 'Removal of a tooth.',
    items: [
      ['Tooth extraction', 1],
      ['Post-extraction review', 1],
    ],
  },
  {
    name: 'Wisdom Tooth Surgical Extraction',
    category: PlanTemplateCategory.ORAL_SURGERY,
    description: 'Surgical removal of an impacted wisdom tooth.',
    items: [
      ['OPG X-ray & assessment', 1],
      ['Surgical extraction', 1],
      ['Suture removal & review', 1],
    ],
  },
  {
    name: 'Crown / Bridge',
    category: PlanTemplateCategory.PROSTHODONTICS,
    description: 'Cap or bridge to restore a damaged or missing tooth.',
    items: [
      ['Tooth preparation & impression', 1],
      ['Try-in', 1],
      ['Cementation', 1],
    ],
  },
  {
    name: 'Dental Implant',
    category: PlanTemplateCategory.IMPLANTOLOGY,
    description: 'Implant with crown.',
    items: [
      ['Assessment & CBCT scan', 1],
      ['Implant placement (surgery)', 1],
      ['Healing review', 1],
      ['Abutment & impression', 1],
      ['Crown placement', 1],
    ],
  },
  {
    name: 'Complete / Partial Denture',
    category: PlanTemplateCategory.PROSTHODONTICS,
    description: 'Removable denture.',
    items: [
      ['Impressions', 1],
      ['Bite registration', 1],
      ['Try-in', 1],
      ['Denture delivery & adjustment', 1],
    ],
  },
  {
    name: 'Braces (Orthodontics)',
    category: PlanTemplateCategory.ORTHODONTICS,
    description: 'Fixed braces treatment.',
    items: [
      ['Records, X-rays & impressions', 1],
      ['Braces bonding', 1],
      ['Monthly adjustments', 12],
      ['Braces removal & retainer', 1],
    ],
  },
  {
    name: 'Teeth Whitening',
    category: PlanTemplateCategory.COSMETIC,
    description: 'In-clinic whitening.',
    items: [
      ['Scaling before whitening', 1],
      ['Whitening session', 2],
    ],
  },
  {
    name: 'Pulpotomy (Child)',
    category: PlanTemplateCategory.PEDIATRIC,
    description: 'Pulp treatment for a milk tooth.',
    items: [
      ['Pulpotomy', 1],
      ['Stainless-steel crown', 1],
    ],
  },
];

export const DEFAULT_PLAN_TEMPLATES = DEFAULTS.map((t) => ({
  name: t.name,
  category: t.category,
  description: t.description,
  items: toItems(t.items),
}));
