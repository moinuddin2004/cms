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
import { Can } from 'src/access/decorators/access.decorators';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { ClinicCall } from 'src/lab-orders/common/order-context';
import { LabOrdersService } from 'src/lab-orders/services/lab-orders.service';
import { ClinicActor, CurrentClinicActor } from 'src/labs/common/clinic-actor';
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

/**
 * Clinic side of production on an order (lab ERD §14 steps 6–8): stages,
 * try-ins, approvals / corrections, final reject → remake, delivery.
 * `lab.orders.view` reads, `lab.orders.create` acts (orders outside the
 * caller's view scope answer 404); the workflow still decides which
 * (derived legacy) role may take each step.
 */
@Controller('lab-orders')
export class ClinicProductionController {
  constructor(
    private readonly orders: LabOrdersService,
    private readonly reader: ProductionReaderService,
    private readonly production: ClinicProductionService,
  ) {}

  @Get(':id/production')
  @Can('lab.orders.view')
  async view(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.orders.visible({ tenant, actor, ref }, id);
    return ResponseWrapper.success(
      await this.reader.orderProduction(id, 'clinic'),
    );
  }

  @Post(':id/stages/:stageId/tryin')
  @HttpCode(HttpStatus.OK)
  @Can('lab.orders.create')
  async tryin(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() dto: TryinDto,
  ) {
    await this.orders.visible({ tenant, actor, ref }, id);
    await this.production.recordTryin({ tenant, actor, ref }, id, stageId, dto);
    return this.done(id, 'Try-in recorded');
  }

  @Post(':id/stages/:stageId/decision')
  @HttpCode(HttpStatus.OK)
  @Can('lab.orders.create')
  async decide(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() dto: StageDecisionDto,
  ) {
    await this.orders.visible({ tenant, actor, ref }, id);
    await this.production.decideStage({ tenant, actor, ref }, id, stageId, dto);
    return this.done(
      id,
      dto.decision === 'approve' ? 'Stage approved' : 'Correction sent to lab',
    );
  }

  @Post(':id/items/:itemId/reject')
  @HttpCode(HttpStatus.OK)
  @Can('lab.orders.create')
  async reject(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: RejectWorkDto,
  ) {
    await this.orders.visible({ tenant, actor, ref }, id);
    await this.production.rejectWork({ tenant, actor, ref }, id, itemId, dto);
    return this.done(id, 'Work rejected — remake requested');
  }

  @Post(':id/items/:itemId/approve')
  @HttpCode(HttpStatus.OK)
  @Can('lab.orders.create')
  async approve(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: OptionalVersionDto,
  ) {
    await this.orders.visible({ tenant, actor, ref }, id);
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
  @Can('lab.orders.create')
  async deliver(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: OptionalVersionDto,
  ) {
    await this.orders.visible({ tenant, actor, ref }, id);
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
  @Can('lab.orders.create')
  async cancel(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: ReasonDto,
  ) {
    await this.orders.visible({ tenant, actor, ref }, id);
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
  @Can('lab.orders.create')
  async requestRemake(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: RequestRemakeDto,
  ) {
    await this.orders.visible({ tenant, actor, ref }, id);
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
  @Can('lab.orders.create')
  async decideRemake(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('remakeId', ParseUUIDPipe) remakeId: string,
    @Body() dto: RemakeDecisionDto,
  ) {
    await this.orders.visible({ tenant, actor, ref }, id);
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
 * Receiving a parcel is front-desk work: there is no shipments permission
 * in the catalog, so receive / lost need only `lab.orders.view` (the
 * workflow's `receive` roles still apply); sending work needs
 * `lab.orders.create`.
 */
@Controller('lab-shipments')
export class ClinicShipmentsController {
  constructor(
    private readonly reader: ProductionReaderService,
    private readonly shipments: ShipmentsService,
  ) {}

  @Get()
  @Can('lab.orders.view')
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
  @Can('lab.orders.view')
  async byToken(
    @ActiveTenant() tenant: TenantContext,
    @Param('token') token: string,
  ) {
    const id = await this.shipments.idByToken(tenant.organizationId, token);
    return ResponseWrapper.success(await this.reader.shipment(id));
  }

  @Get(':id')
  @Can('lab.orders.view')
  async get(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
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
  @Can('lab.orders.create')
  async dispatch(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
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
  @Can('lab.orders.view')
  async receive(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
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
  @Can('lab.orders.view')
  async lost(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
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
