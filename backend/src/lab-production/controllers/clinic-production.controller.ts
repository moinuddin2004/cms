import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { CurrentActor, Roles } from 'src/common/decorators/roles.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { Actor, ALL_APP_ROLES, AppRole } from 'src/common/enums/app-role.enum';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { ClinicCall } from 'src/lab-orders/common/order-context';
import { LabOrdersService } from 'src/lab-orders/services/lab-orders.service';
import { LAB_FEATURE } from 'src/labs/labs.constants';
import {
  DispatchShipmentDto,
  LostShipmentDto,
  OptionalVersionDto,
  ReasonDto,
  ReceiveShipmentDto,
  RejectWorkDto,
  RemakeDecisionDto,
  RequestRemakeDto,
  ShipmentsQueryDto,
  StageDecisionDto,
  TryinDto,
} from '../dto/production.dto';
import { ClinicProductionService } from '../services/clinic-production.service';
import { ProductionReaderService } from '../services/production-reader.service';
import { ShipmentsService } from '../services/shipments.service';

const DOCTORS = [AppRole.CLINIC_ADMIN, AppRole.DOCTOR];

/**
 * Clinic side of production on an order (lab ERD §14 steps 6–8): stages,
 * try-ins, approvals / corrections, final reject → remake, delivery. The
 * workflow decides who may take each step (doctors approve; any clinic
 * role may receive).
 */
@Controller('lab-orders')
@RequireFeature(LAB_FEATURE)
export class ClinicProductionController {
  constructor(
    private readonly orders: LabOrdersService,
    private readonly reader: ProductionReaderService,
    private readonly production: ClinicProductionService,
  ) {}

  @Get(':id/production')
  @Roles(...ALL_APP_ROLES)
  async view(
    @ActiveTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.orders.byId(tenant.organizationId, id);
    return ResponseWrapper.success(
      await this.reader.orderProduction(id, 'clinic'),
    );
  }

  @Post(':id/stages/:stageId/tryin')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_APP_ROLES)
  async tryin(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() dto: TryinDto,
  ) {
    await this.production.recordTryin({ tenant, actor, ref }, id, stageId, dto);
    return this.done(id, 'Try-in recorded');
  }

  @Post(':id/stages/:stageId/decision')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_APP_ROLES)
  async decide(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() dto: StageDecisionDto,
  ) {
    await this.production.decideStage({ tenant, actor, ref }, id, stageId, dto);
    return this.done(
      id,
      dto.decision === 'approve' ? 'Stage approved' : 'Correction sent to lab',
    );
  }

  @Post(':id/items/:itemId/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_APP_ROLES)
  async reject(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: RejectWorkDto,
  ) {
    await this.production.rejectWork({ tenant, actor, ref }, id, itemId, dto);
    return this.done(id, 'Work rejected — remake requested');
  }

  @Post(':id/items/:itemId/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_APP_ROLES)
  async approve(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: OptionalVersionDto,
  ) {
    await this.production.approveWork(
      { tenant, actor, ref },
      id,
      itemId,
      dto.version,
    );
    return this.done(id, 'Work approved');
  }

  @Post(':id/items/:itemId/deliver')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_APP_ROLES)
  async deliver(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: OptionalVersionDto,
  ) {
    await this.production.deliver(
      { tenant, actor, ref },
      id,
      itemId,
      dto.version,
    );
    return this.done(id, 'Delivered — warranty started');
  }

  @Post(':id/items/:itemId/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_APP_ROLES)
  async cancel(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: ReasonDto,
  ) {
    await this.production.cancelItem(
      { tenant, actor, ref },
      id,
      itemId,
      dto.reason,
      dto.version,
    );
    return this.done(id, 'Item cancelled');
  }

  @Post(':id/items/:itemId/remake-requests')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...DOCTORS)
  async requestRemake(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: RequestRemakeDto,
  ) {
    await this.production.requestRemake(
      { tenant, actor, ref },
      id,
      itemId,
      dto,
    );
    return this.done(id, 'Remake requested');
  }

  @Post(':id/remake-requests/:remakeId/decision')
  @HttpCode(HttpStatus.OK)
  @Roles(...DOCTORS)
  async decideRemake(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('remakeId', ParseUUIDPipe) remakeId: string,
    @Body() dto: RemakeDecisionDto,
  ) {
    await this.production.decideRemake(
      { tenant, actor, ref },
      id,
      remakeId,
      dto,
    );
    return this.done(
      id,
      dto.decision === 'agree' ? 'Remake agreed' : 'Remake request closed',
    );
  }

  private async done(orderId: string, message: string) {
    return ResponseWrapper.success(
      await this.reader.orderProduction(orderId, 'clinic'),
      message,
    );
  }
}

/**
 * Clinic shipments (lab ERD §5b): incoming work to receive (also by the
 * slip's QR token) and outgoing impressions / models to the lab.
 */
@Controller('lab-shipments')
@RequireFeature(LAB_FEATURE)
export class ClinicShipmentsController {
  constructor(
    private readonly reader: ProductionReaderService,
    private readonly shipments: ShipmentsService,
  ) {}

  @Get()
  @Roles(...ALL_APP_ROLES)
  async list(
    @ActiveTenant() tenant: TenantContext,
    @Query() q: ShipmentsQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.reader.shipments({ organizationId: tenant.organizationId }, q),
    );
  }

  /** The QR slip opens this (receive screen). */
  @Get('by-token/:token')
  @Roles(...ALL_APP_ROLES)
  async byToken(
    @ActiveTenant() tenant: TenantContext,
    @Param('token') token: string,
  ) {
    const id = await this.shipments.idByToken(tenant.organizationId, token);
    return ResponseWrapper.success(await this.reader.shipment(id));
  }

  @Get(':id')
  @Roles(...ALL_APP_ROLES)
  async get(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    await this.shipments.assertVisible({ side: 'clinic', c }, id);
    return ResponseWrapper.success(await this.reader.shipment(id));
  }

  /** Impressions / models / work going back to the lab. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(...ALL_APP_ROLES)
  async dispatch(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Body() dto: DispatchShipmentDto,
  ) {
    const id = await this.shipments.dispatchToLab({ tenant, actor, ref }, dto);
    return ResponseWrapper.success(
      await this.reader.shipment(id),
      'Shipment dispatched',
    );
  }

  @Post(':id/receive')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_APP_ROLES)
  async receive(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveShipmentDto,
  ) {
    await this.shipments.receive(
      { side: 'clinic', c: { tenant, actor, ref } },
      id,
      dto,
    );
    return ResponseWrapper.success(
      await this.reader.shipment(id),
      'Shipment received',
    );
  }

  @Post(':id/lost')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_APP_ROLES)
  async lost(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LostShipmentDto,
  ) {
    await this.shipments.markLost(
      { side: 'clinic', c: { tenant, actor, ref } },
      id,
      dto.reason,
    );
    return ResponseWrapper.success(
      await this.reader.shipment(id),
      'Shipment marked lost',
    );
  }
}
