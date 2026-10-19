/** How a lab service is counted on an order line (lab ERD §4). */
export enum UnitType {
  PER_TOOTH = 'per_tooth',
  PER_UNIT = 'per_unit',
  PER_ARCH = 'per_arch',
  PER_CASE = 'per_case',
}

export enum OptionType {
  MATERIAL = 'material',
  VARIANT = 'variant',
}

/** Where a resolved lab price came from. */
export enum LabPriceSource {
  /** This clinic's negotiated price (`organization_id` set). */
  NEGOTIATED = 'negotiated',
  /** The lab's list price (`organization_id` null). */
  LIST = 'list',
}

/** Status-history / audit `entity_type` values written by this module. */
export const CATALOG_ENTITY = {
  SERVICE_CATEGORY: 'service_category',
  LAB_SERVICE: 'lab_service',
  LAB_SERVICE_OPTION: 'lab_service_option',
  LAB_SERVICE_PRICE: 'lab_service_price',
  SERVICE_MAPPING: 'service_mapping',
  ORDER_TEMPLATE: 'order_template',
} as const;
