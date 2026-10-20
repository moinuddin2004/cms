import { EntityManager } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { productionError } from './production-errors';

/** A submitted item with what production needs to know about its order. */
export interface ProductionItem {
  id: string;
  organization_id: string;
  order_id: string;
  order_no: string | null;
  lab_id: string;
  status_code: string;
  version: number;
  line_no: number;
  quantity: number;
  service_name_snap: string | null;
}

const SELECT = `SELECT i.id, i.organization_id, i.order_id, o.order_no, o.lab_id, i.status_code,
                       i.version, i.line_no, i.quantity, i.service_name_snap
                  FROM lab_order_items i JOIN lab_orders o ON o.id = i.order_id`;

/** An item of the clinic's order (tenant-scoped), or 404. */
export async function clinicItem(
  m: EntityManager,
  organizationId: string,
  orderId: string,
  itemId: string,
): Promise<ProductionItem> {
  const [row] = await sqlRows<ProductionItem>(
    m,
    `${SELECT} WHERE i.id = $1 AND i.order_id = $2 AND i.organization_id = $3
                 AND i.status_code IS NOT NULL`,
    [itemId, orderId, organizationId],
  );
  if (!row)
    throw productionError('PRODUCTION_ITEM_NOT_FOUND', 'Item not found');
  return row;
}

/** An item of an order sent to the lab (lab-scoped, never a draft), or 404. */
export async function labItem(
  m: EntityManager,
  labId: string,
  itemId: string,
): Promise<ProductionItem> {
  const [row] = await sqlRows<ProductionItem>(
    m,
    `${SELECT} WHERE i.id = $1 AND o.lab_id = $2 AND i.status_code IS NOT NULL
                 AND o.status_code <> 'draft'`,
    [itemId, labId],
  );
  if (!row)
    throw productionError('PRODUCTION_ITEM_NOT_FOUND', 'Item not found');
  return row;
}

/** Item states after which nothing more is made or shipped. */
export const CLOSED_ITEM_STATES = new Set([
  'delivered',
  'cancelled',
  'rejected',
  'remake_required',
]);
