import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ContextFree } from 'src/common/decorators/context-free.decorator';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { sqlRows } from 'src/common/database/sql';
import { findLabMemberships } from 'src/labs/portal/lab-memberships';
import { accessError } from '../common/access-errors';

export type OrderLinkTarget =
  | { target: 'lab'; labId: string; path: string }
  | {
      target: 'clinic';
      organizationId: string;
      locationId: string;
      path: string;
    };

/**
 * Where the work-order QR (`/o/:orderId`) takes the signed-in user: a member
 * of the order's lab → the lab portal order; staff of the ordering clinic
 * (owner, or an active assignment) → the clinic order, with the org /
 * location to switch to. Anyone else gets the same 404 as a missing order,
 * so the QR leaks nothing. No tenant headers needed (`@ContextFree`).
 */
@ContextFree()
@Controller('order-links')
export class OrderLinkController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get(':orderId')
  async resolve(
    @CurrentUserId() userId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    const notFound = () =>
      accessError('ORDER_LINK_NOT_FOUND', 'Order not found');
    const [order] = await sqlRows<{
      id: string;
      lab_id: string;
      organization_id: string;
      location_id: string;
      status_code: string;
    }>(
      this.dataSource,
      `SELECT id, lab_id, organization_id, location_id, status_code
         FROM lab_orders WHERE id = $1`,
      [orderId],
    );
    if (!order || !userId) throw notFound();

    const labs = await findLabMemberships(this.dataSource.manager, userId);
    if (
      order.status_code !== 'draft' &&
      labs.some((l) => l.labId === order.lab_id)
    ) {
      return ResponseWrapper.success<OrderLinkTarget>({
        target: 'lab',
        labId: order.lab_id,
        path: `/lab-portal/orders/${order.id}`,
      });
    }

    const [access] = await sqlRows<{ location_id: string | null }>(
      this.dataSource,
      `SELECT CASE WHEN EXISTS (
                SELECT 1 FROM organization_ownership
                 WHERE user_id = $1 AND organization_id = $2)
              THEN $3::uuid
              ELSE (SELECT a.location_id FROM employee_org_location_assignments a
                     WHERE a.user_id = $1 AND a.organization_id = $2 AND a.is_active
                     ORDER BY (a.location_id = $3::uuid) DESC LIMIT 1)
              END AS location_id`,
      [userId, order.organization_id, order.location_id],
    );
    if (!access?.location_id) throw notFound();
    return ResponseWrapper.success<OrderLinkTarget>({
      target: 'clinic',
      organizationId: order.organization_id,
      locationId: access.location_id,
      path: `/lab-orders/${order.id}`,
    });
  }
}
