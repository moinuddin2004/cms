import { Can } from 'src/access/decorators/access.decorators';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  ActorRef,
  ActorSide,
  TransitionVia,
} from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { PROXY_PERMISSIONS } from 'src/engine/runtime/workflow-engine.service';
import { orderError } from 'src/lab-orders/common/order-errors';
import { LabOrdersService } from 'src/lab-orders/services/lab-orders.service';
import { ClinicActor, CurrentClinicActor } from 'src/labs/common/clinic-actor';
import {
  LabOrderActionsService,
  LabSideCall,
} from '../actions/lab-order-actions.service';
import {
  AcceptOrderDto,
  ClarificationDto,
  ExpectedDateDto,
  IssueMagicLinkDto,
  RejectOrderDto,
} from '../dto/lab-access.dto';
import { MagicLinkDelivery } from '../entities/magic-link.entity';
import { MagicLinksService } from '../magic-links/magic-links.service';

/**
 * Clinic side of lab access (lab ERD §7, §14 step 5):
 * - magic links of an order: list (with delivery status), send / copy a
 *   new one, revoke;
 * - proxy mode: when the lab doesn't answer, a lab coordinator
 *   (PROXY_PERMISSIONS, the engine checks them too) records the lab's
 *   answer — `via = proxy`, `on_behalf_of_lab_id` = the order's lab.
 */
@Controller('lab-orders')
export class ClinicLabAccessController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly orders: LabOrdersService,
    private readonly links: MagicLinksService,
    private readonly actions: LabOrderActionsService,
  ) {}

  @Get(':id/magic-links')
  @Can('lab.orders.view')
  async listLinks(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const order = await this.orders.visible({ tenant, actor, ref }, id);
    return ResponseWrapper.success(
      await this.links.forOrder(tenant.organizationId, order.id),
    );
  }

  @Post(':id/magic-links')
  @HttpCode(HttpStatus.CREATED)
  @Can('lab.orders.create')
  async issueLink(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueMagicLinkDto,
  ) {
    const order = await this.orders.visible({ tenant, actor, ref }, id);
    if (!order.orderNo || order.statusCode === 'draft') {
      throw orderError(
        'LAB_ORDER_INVALID',
        'Submit the order before sending the lab a link',
      );
    }
    const delivery = dto.delivery ?? MagicLinkDelivery.NOTIFICATION;
    if (
      delivery === MagicLinkDelivery.NOTIFICATION &&
      !order.lab.whatsappPhone &&
      !order.lab.phone &&
      !order.lab.email
    ) {
      throw orderError(
        'LAB_ORDER_INVALID',
        'The lab has no WhatsApp number, phone or email — copy the link instead',
      );
    }
    const { link, url } = await this.dataSource.transaction((m) =>
      this.links.issue(m, {
        order,
        createdBy: actor.userId,
        ref,
        delivery,
        purpose: dto.purpose,
        expiresInHours: dto.expiresInHours,
      }),
    );
    return ResponseWrapper.success(
      { id: link.id, expiresAt: link.expiresAt, url },
      delivery === MagicLinkDelivery.COPY ? 'Link created' : 'Link sent',
    );
  }

  @Post(':id/magic-links/:linkId/revoke')
  @Can('lab.orders.create')
  async revokeLink(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    await this.orders.visible({ tenant, actor, ref }, id);
    await this.links.revoke(tenant.organizationId, id, linkId, ref);
    return ResponseWrapper.success(null, 'Link revoked');
  }

  // ── proxy mode ────────────────────────────────────────────────────────

  @Get(':id/proxy/actions')
  @Can(...PROXY_PERMISSIONS)
  async proxyActions(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const order = await this.orders.byId(tenant.organizationId, id);
    return ResponseWrapper.success({
      actions: await this.actions.available(
        order,
        this.proxy(actor, ref, order.labId),
      ),
    });
  }

  @Post(':id/proxy/accept')
  @Can(...PROXY_PERMISSIONS)
  async proxyAccept(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptOrderDto,
  ) {
    const order = await this.orders.byId(tenant.organizationId, id);
    await this.actions.accept(order, dto, this.proxy(actor, ref, order.labId));
    return ResponseWrapper.success(null, 'Accepted on behalf of the lab');
  }

  @Post(':id/proxy/reject')
  @Can(...PROXY_PERMISSIONS)
  async proxyReject(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectOrderDto,
  ) {
    const order = await this.orders.byId(tenant.organizationId, id);
    await this.actions.reject(order, dto, this.proxy(actor, ref, order.labId));
    return ResponseWrapper.success(null, 'Rejected on behalf of the lab');
  }

  @Post(':id/proxy/clarification')
  @Can(...PROXY_PERMISSIONS)
  async proxyClarify(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClarificationDto,
  ) {
    const order = await this.orders.byId(tenant.organizationId, id);
    await this.actions.clarify(order, dto, this.proxy(actor, ref, order.labId));
    return ResponseWrapper.success(null, 'Question recorded for the lab');
  }

  @Post(':id/proxy/expected-date')
  @Can(...PROXY_PERMISSIONS)
  async proxyExpectedDate(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExpectedDateDto,
  ) {
    const order = await this.orders.byId(tenant.organizationId, id);
    await this.actions.changeExpectedDate(
      order,
      dto,
      this.proxy(actor, ref, order.labId),
    );
    return ResponseWrapper.success(null, 'Expected date changed');
  }

  private proxy(actor: ClinicActor, ref: ActorRef, labId: string): LabSideCall {
    return {
      actor: {
        userId: actor.userId,
        side: 'clinic',
        roles: actor.roles,
        can: (p) => actor.access.can(p),
        via: TransitionVia.PROXY,
        ip: ref.ip ?? null,
        requestId: ref.requestId ?? null,
      },
      onBehalfOfLabId: labId,
      ref,
      authorUserId: actor.userId,
    };
  }
}
