import type { FieldType } from './form-definition.types';

/**
 * Typed columns a form answer may be copied ("promoted") into, so reports
 * read real columns instead of JSON (lab ERD §3). The registry is code: a
 * schema can only point at columns that exist. `dental_item_details` is
 * created with orders (Sprint 6); the promotion copy runs at order submit.
 */
export const PROMOTION_TARGETS: Record<string, readonly FieldType[]> = {
  'dental_item_details.shade_system': ['select', 'text'],
  'dental_item_details.shade': ['select', 'text'],
  'dental_item_details.material_code': ['select', 'text'],
  'dental_item_details.implant_system': ['select', 'text'],
  'dental_item_details.implant_platform': ['select', 'text'],
  'dental_item_details.implant_diameter_mm': ['number'],
  'dental_item_details.margin_type': ['select', 'text'],
};
