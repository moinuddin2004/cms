import {
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { LabMemberRole } from 'src/labs/enums/lab.enums';
import {
  LabActor,
  LabPortalController,
  LabRoles,
} from 'src/labs/portal/lab-actor';
import type { LabActorContext } from 'src/labs/portal/lab-portal.constants';
import { labItem } from '../common/production-items';
import { QcResult } from '../enums/production.enums';
import {
  AssignDto,
  DispatchShipmentDto,
  DisputeRemakeDto,
  LostShipmentDto,
  OptionalVersionDto,
  ProductionItemsQueryDto,
  QcDto,
  ReceiveShipmentDto,
  RemakesQueryDto,
  ShipmentsQueryDto,
} from '../dto/production.dto';
import { LabWorkService } from '../services/lab-work.service';
import { ProductionReaderService } from '../services/production-reader.service';
import { ShipmentsService } from '../services/shipments.service';

/**
 * The lab's production desk (lab ERD §14 step 6): work queue, start,
 * technician assignment, finish → QC, shipments to the clinic, receiving
 * impressions, remake requests. `LabPortalGuard` scopes every call to the
 * member's lab; responses never carry patient prices.
 */
@LabPortalController('production')
export class LabProductionController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly reader: ProductionReaderService,
    private readonly work: LabWorkService,
    private readonly shipments: ShipmentsService,
  ) {}

  @Get('items')
  async items(
    @LabActor() lab: LabActorContext,
    @Query() q: ProductionItemsQueryDto,
  ) {
    return ResponseWrapper.success(await this.reader.labItems(lab.labId, q));
  }

  @Get('items/:itemId/stages')
  async stages(
    @LabActor() lab: LabActorContext,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    await labItem(this.dataSource.manager, lab.labId, itemId);
    return ResponseWrapper.success(await this.reader.itemStages(itemId));
  }

  @Get('technicians')
  async technicians(@LabActor() lab: LabActorContext) {
    return ResponseWrapper.success(await this.work.technicians(lab.labId));
  }

  @Post('items/:itemId/start')
  @HttpCode(HttpStatus.OK)
  async start(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: OptionalVersionDto,
  ) {
    await this.work.start({ lab, ref }, itemId, dto.version);
    return ResponseWrapper.success(null, 'Work started');
  }

  @Post('items/:itemId/assign')
  @HttpCode(HttpStatus.OK)
  @LabRoles(LabMemberRole.LAB_ADMIN)
  async assign(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: AssignDto,
  ) {
    await this.work.assign({ lab, ref }, itemId, dto.labMemberId);
    return ResponseWrapper.success(null, 'Technician assigned');
  }

  @Post('items/:itemId/unassign')
  @HttpCode(HttpStatus.OK)
  @LabRoles(LabMemberRole.LAB_ADMIN)
  async unassign(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    await this.work.unassign({ lab, ref }, itemId);
    return ResponseWrapper.success(null, 'Technician unassigned');
  }

  @Post('items/:itemId/finish')
  @HttpCode(HttpStatus.OK)
  async finish(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: OptionalVersionDto,
  ) {
    await this.work.finish({ lab, ref }, itemId, dto.version);
    return ResponseWrapper.success(null, 'Sent to QC');
  }

  @Post('items/:itemId/qc')
  @HttpCode(HttpStatus.OK)
  async qc(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: QcDto,
  ) {
    await this.work.qc({ lab, ref }, itemId, dto);
    return ResponseWrapper.success(
      null,
      dto.result === QcResult.PASS
        ? 'QC passed — ready'
        : 'QC failed — back to work',
    );
  }

  @Get('shipments')
  async listShipments(
    @LabActor() lab: LabActorContext,
    @Query() q: ShipmentsQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.reader.shipments({ labId: lab.labId }, q),
    );
  }

  @Get('shipments/:id')
  async shipment(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.shipments.assertVisible({ side: 'lab', c: { lab, ref } }, id);
    return ResponseWrapper.success(await this.reader.shipment(id));
  }

  /** Try-in rounds and finished work to the clinic. */
  @Post('shipments')
  @HttpCode(HttpStatus.CREATED)
  async dispatch(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Body() dto: DispatchShipmentDto,
  ) {
    const id = await this.shipments.dispatchToClinic({ lab, ref }, dto);
    return ResponseWrapper.success(
      await this.reader.shipment(id),
      'Shipment dispatched',
    );
  }

  /** Impressions / models from the clinic. */
  @Post('shipments/:id/receive')
  @HttpCode(HttpStatus.OK)
  async receive(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveShipmentDto,
  ) {
    await this.shipments.receive({ side: 'lab', c: { lab, ref } }, id, dto);
    return ResponseWrapper.success(
      await this.reader.shipment(id),
      'Shipment received',
    );
  }

  @Post('shipments/:id/lost')
  @HttpCode(HttpStatus.OK)
  async lost(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LostShipmentDto,
  ) {
    await this.shipments.markLost(
      { side: 'lab', c: { lab, ref } },
      id,
      dto.reason,
    );
    return ResponseWrapper.success(
      await this.reader.shipment(id),
      'Shipment marked lost',
    );
  }

  @Get('remake-requests')
  async remakes(@LabActor() lab: LabActorContext, @Query() q: RemakesQueryDto) {
    return ResponseWrapper.success(
      await this.reader.remakes({ labId: lab.labId }, q.status),
    );
  }

  @Post('remake-requests/:id/dispute')
  @HttpCode(HttpStatus.OK)
  @LabRoles(LabMemberRole.LAB_ADMIN)
  async dispute(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisputeRemakeDto,
  ) {
    await this.work.dispute({ lab, ref }, id, dto.version, dto.note);
    return ResponseWrapper.success(null, 'Remake disputed');
  }
}
