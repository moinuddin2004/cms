import type {
  StateCategory,
  TransitionDef,
  WorkflowDefinition,
  WorkflowEntityType,
} from '../workflows/workflow.types';

/**
 * Default dental workflows (lab ERD §9) and stage templates (§11). These are
 * seed DATA, not logic: `EngineSeedService` creates whatever is missing as
 * published version 1 and never changes it afterwards.
 */

export interface WorkflowSeed {
  specialty: string;
  code: string;
  name: string;
  entityType: WorkflowEntityType;
  definition: WorkflowDefinition;
}

export interface StageTemplateSeed {
  specialty: string;
  code: string;
  name: string;
  steps: {
    code: string;
    name: string;
    requiresPatientVisit: boolean;
    requiresDoctorApproval: boolean;
    defaultLabDays: number;
  }[];
}

const s = (code: string, name: string, category: StateCategory) => ({
  code,
  name,
  category,
});

const LAB_ADMIN = ['lab_admin'];
const LAB_STAFF = ['lab_admin', 'lab_technician'];
const DOCTORS = ['doctor', 'clinic_admin'];
const CLINIC_STAFF = ['doctor', 'clinic_admin', 'receptionist'];

const t = (
  from: string,
  action: string,
  to: string,
  sides: TransitionDef['allowedSides'],
  extra: Partial<TransitionDef> = {},
): TransitionDef => ({ from, action, to, allowedSides: sides, ...extra });

const derive = (from: string, to: string) => t(from, 'derive', to, ['system']);

// ── 9a. Item lifecycle ───────────────────────────────────────────────────
const ITEM: WorkflowDefinition = {
  states: [
    s('pending_acceptance', 'Waiting for lab', 'initial'),
    s('accepted', 'Accepted', 'active'),
    s('in_production', 'In production', 'active'),
    s('at_clinic_tryin', 'At clinic for try-in', 'waiting'),
    s('qc', 'Quality check', 'active'),
    s('ready', 'Ready', 'waiting'),
    s('dispatched', 'Dispatched', 'waiting'),
    s('received', 'Received', 'waiting'),
    s('approved', 'Approved', 'waiting'),
    s('delivered', 'Delivered', 'done'),
    s('rejected', 'Rejected by lab', 'cancelled'),
    s('cancelled', 'Cancelled', 'cancelled'),
    s('remake_required', 'Remake required', 'cancelled'),
  ],
  transitions: [
    t('pending_acceptance', 'accept', 'accepted', ['lab'], {
      allowedRoles: LAB_ADMIN,
      requiredFields: ['lab_expected_on'],
    }),
    t('pending_acceptance', 'reject', 'rejected', ['lab'], {
      allowedRoles: LAB_ADMIN,
      requiresReason: true,
    }),
    t('accepted', 'start', 'in_production', ['lab'], {
      allowedRoles: LAB_STAFF,
    }),
    // Driven by shipments of try-in stages (Sprint 8).
    t('in_production', 'send_tryin', 'at_clinic_tryin', ['system']),
    t('at_clinic_tryin', 'resume', 'in_production', ['system']),
    t('in_production', 'finish', 'qc', ['lab'], { allowedRoles: LAB_STAFF }),
    t('qc', 'qc_fail', 'in_production', ['lab'], {
      allowedRoles: LAB_STAFF,
      requiresReason: true,
    }),
    t('qc', 'qc_pass', 'ready', ['lab'], { allowedRoles: LAB_STAFF }),
    t('ready', 'dispatch', 'dispatched', ['system']),
    t('dispatched', 'receive', 'received', ['clinic', 'system'], {
      allowedRoles: CLINIC_STAFF,
    }),
    t('received', 'approve', 'approved', ['clinic'], { allowedRoles: DOCTORS }),
    t('received', 'reject_work', 'remake_required', ['clinic'], {
      allowedRoles: DOCTORS,
      requiresReason: true,
    }),
    t('approved', 'deliver', 'delivered', ['clinic'], {
      allowedRoles: DOCTORS,
    }),
    t('accepted', 'cancel', 'cancelled', ['clinic'], {
      allowedRoles: DOCTORS,
      requiresReason: true,
    }),
    t('in_production', 'cancel', 'cancelled', ['clinic'], {
      allowedRoles: DOCTORS,
      requiresReason: true,
    }),
  ],
};

// ── 9b. Stage lifecycle (one try-in round) ─────────────────────────────
const STAGE: WorkflowDefinition = {
  states: [
    s('pending', 'Pending', 'initial'),
    s('at_lab', 'At lab', 'active'),
    s('sent_to_clinic', 'Sent to clinic', 'waiting'),
    s('received', 'Received', 'waiting'),
    s('tryin_done', 'Try-in done', 'waiting'),
    s('approved', 'Approved', 'done'),
    // Closes this round; the correction continues in round_no + 1.
    s('correction', 'Correction needed', 'cancelled'),
  ],
  transitions: [
    t('pending', 'start', 'at_lab', ['system']),
    t('at_lab', 'dispatch', 'sent_to_clinic', ['lab', 'system'], {
      allowedRoles: LAB_STAFF,
    }),
    t('sent_to_clinic', 'receive', 'received', ['clinic', 'system'], {
      allowedRoles: CLINIC_STAFF,
    }),
    t('received', 'record_tryin', 'tryin_done', ['clinic'], {
      allowedRoles: DOCTORS,
    }),
    t('tryin_done', 'approve', 'approved', ['clinic'], {
      allowedRoles: DOCTORS,
    }),
    t('tryin_done', 'request_correction', 'correction', ['clinic'], {
      allowedRoles: DOCTORS,
      requiresReason: true,
      requiredFields: ['correction_notes'],
    }),
  ],
};

// ── 9c. Order lifecycle ────────────────────────────────────────────────
const ORDER: WorkflowDefinition = {
  states: [
    s('draft', 'Draft', 'initial'),
    s('submitted', 'Submitted', 'active'),
    s('clarification_needed', 'Clarification needed', 'waiting'),
    s('rejected_by_lab', 'Rejected by lab', 'waiting'),
    s('accepted', 'Accepted', 'active'),
    s('in_progress', 'In progress', 'active'),
    s('on_hold', 'On hold', 'waiting'),
    s('partially_ready', 'Partially ready', 'active'),
    s('ready', 'Ready', 'waiting'),
    s('partially_received', 'Partially received', 'active'),
    s('under_review', 'Under review', 'waiting'),
    s('completed', 'Completed', 'done'),
    s('cancelled', 'Cancelled', 'cancelled'),
  ],
  transitions: [
    t('draft', 'submit', 'submitted', ['clinic'], { allowedRoles: DOCTORS }),
    t('submitted', 'request_clarification', 'clarification_needed', ['lab'], {
      allowedRoles: LAB_ADMIN,
      requiresReason: true,
    }),
    t('clarification_needed', 'reply', 'submitted', ['clinic'], {
      allowedRoles: DOCTORS,
    }),
    t('submitted', 'reject', 'rejected_by_lab', ['lab'], {
      allowedRoles: LAB_ADMIN,
      requiresReason: true,
    }),
    t('rejected_by_lab', 'reopen', 'draft', ['clinic'], {
      allowedRoles: DOCTORS,
    }),
    t('in_progress', 'hold', 'on_hold', ['clinic'], {
      allowedRoles: DOCTORS,
      requiresReason: true,
    }),
    t('on_hold', 'resume', 'in_progress', ['clinic'], {
      allowedRoles: DOCTORS,
      effects: [{ code: 'recompute_order_status' }],
    }),
    t('draft', 'cancel', 'cancelled', ['clinic'], {
      allowedRoles: DOCTORS,
      requiresReason: true,
    }),
    t('submitted', 'cancel', 'cancelled', ['clinic'], {
      allowedRoles: DOCTORS,
      requiresReason: true,
    }),
    t('accepted', 'cancel', 'cancelled', ['clinic'], {
      allowedRoles: DOCTORS,
      requiresReason: true,
    }),
    // Derived from items (order-status.ts); listed so the map is complete.
    derive('submitted', 'accepted'),
    derive('accepted', 'in_progress'),
    derive('in_progress', 'partially_ready'),
    derive('partially_ready', 'ready'),
    derive('in_progress', 'ready'),
    derive('ready', 'partially_received'),
    derive('partially_received', 'under_review'),
    derive('ready', 'under_review'),
    derive('under_review', 'in_progress'),
    derive('under_review', 'completed'),
  ],
};

export const WORKFLOW_SEEDS: WorkflowSeed[] = [
  {
    specialty: 'DENTAL',
    code: 'DENTAL_ORDER',
    name: 'Dental order',
    entityType: 'order',
    definition: ORDER,
  },
  {
    specialty: 'DENTAL',
    code: 'DENTAL_ITEM',
    name: 'Dental item',
    entityType: 'item',
    definition: ITEM,
  },
  {
    specialty: 'DENTAL',
    code: 'DENTAL_STAGE',
    name: 'Try-in stage',
    entityType: 'stage',
    definition: STAGE,
  },
];

export const STAGE_TEMPLATE_SEEDS: StageTemplateSeed[] = [
  {
    specialty: 'DENTAL',
    code: 'SINGLE_STAGE',
    name: 'Single stage',
    steps: [
      {
        code: 'final',
        name: 'Final',
        requiresPatientVisit: true,
        requiresDoctorApproval: true,
        defaultLabDays: 5,
      },
    ],
  },
  {
    specialty: 'DENTAL',
    code: 'PFM_3_STAGE',
    name: 'PFM — metal, bisque, final',
    steps: [
      {
        code: 'metal_tryin',
        name: 'Metal try-in',
        requiresPatientVisit: true,
        requiresDoctorApproval: true,
        defaultLabDays: 4,
      },
      {
        code: 'bisque_tryin',
        name: 'Bisque try-in',
        requiresPatientVisit: true,
        requiresDoctorApproval: true,
        defaultLabDays: 3,
      },
      {
        code: 'final',
        name: 'Final',
        requiresPatientVisit: true,
        requiresDoctorApproval: true,
        defaultLabDays: 3,
      },
    ],
  },
  {
    specialty: 'DENTAL',
    code: 'COMPLETE_DENTURE',
    name: 'Complete denture — bite, wax try-in, final',
    steps: [
      {
        code: 'bite',
        name: 'Bite registration',
        requiresPatientVisit: true,
        requiresDoctorApproval: true,
        defaultLabDays: 3,
      },
      {
        code: 'wax_tryin',
        name: 'Wax try-in',
        requiresPatientVisit: true,
        requiresDoctorApproval: true,
        defaultLabDays: 4,
      },
      {
        code: 'final',
        name: 'Final',
        requiresPatientVisit: true,
        requiresDoctorApproval: true,
        defaultLabDays: 5,
      },
    ],
  },
];
