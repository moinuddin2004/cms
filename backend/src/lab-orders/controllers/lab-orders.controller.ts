import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Can } from 'src/access/decorators/access.decorators';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { ClinicActor, CurrentClinicActor } from 'src/labs/common/clinic-actor';
import {
  MAX_ATTACHMENT_BYTES,
  AttachmentsService,
} from '../attachments/attachments.service';
import { ClinicCall } from '../common/order-context';
import {
  CreateMessageDto,
  CreateOrderDto,
  CreateRevisionDto,
  DecideChargeDto,
  FromTemplateDto,
  ListOrdersQueryDto,
  OrderTransitionDto,
  RepeatOrderDto,
  UpdateOrderDto,
  UploadAttachmentDto,
  VersionDto,
} from '../dto/order.dto';
import { AttachmentVisibility, MessageSide } from '../enums/order.enums';
import { LabOrdersService } from '../services/lab-orders.service';
import { OrderDraftsService } from '../services/order-drafts.service';
import { OrderSubmitService } from '../services/order-submit.service';

/**
 * Clinic lab orders (lab ERD §14 steps 2–5). `lab.orders.view` reads
 * (scoped: own = the ordering doctor), `lab.orders.create` prepares and
 * changes orders; the workflow still decides which status actions each
 * (derived legacy) role has.
 */
@Controller('lab-orders')
export class LabOrdersController {
  constructor(
    private readonly drafts: OrderDraftsService,
    private readonly submitter: OrderSubmitService,
    private readonly orders: LabOrdersService,
    private readonly attachments: AttachmentsService,
  ) {}

  @Get()
  @Can('lab.orders.view')
  async list(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Query() q: ListOrdersQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.orders.list({ tenant, actor, ref }, q),
    );
  }

  /** Draft. `Idempotency-Key` (optional): the same key returns the same draft. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Can('lab.orders.create')
  async create(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') key?: string,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    const id = await this.drafts.create(c, dto, key ?? null);
    return ResponseWrapper.success(await this.orders.get(c, id), 'Draft saved');
  }

  @Post('from-template')
  @HttpCode(HttpStatus.CREATED)
  @Can('lab.orders.create')
  async fromTemplate(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Body() dto: FromTemplateDto,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    const id = await this.drafts.fromTemplate(c, dto);
    return ResponseWrapper.success(await this.orders.get(c, id), 'Draft saved');
  }

  @Get(':id')
  @Can('lab.orders.view')
  async get(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.orders.get({ tenant, actor, ref }, id),
    );
  }

  @Patch(':id')
  @Can('lab.orders.create')
  async update(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    await this.orders.visible(c, id);
    await this.drafts.update(c, id, dto);
    return ResponseWrapper.success(await this.orders.get(c, id), 'Draft saved');
  }

  /** Lab ERD §10 "Order submit" — `Idempotency-Key` required. */
  @Post(':id/submit')
  @Can('lab.orders.create')
  async submit(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
    @Headers('idempotency-key') key?: string,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    await this.orders.visible(c, id);
    const result = await this.submitter.submit(c, id, dto.version, key);
    return ResponseWrapper.success(
      { ...(await this.orders.get(c, id)), replayed: result.replayed },
      `Order ${result.orderNo} submitted`,
    );
  }

  @Post(':id/repeat')
  @HttpCode(HttpStatus.CREATED)
  @Can('lab.orders.create')
  async repeat(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RepeatOrderDto,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    await this.orders.visible(c, id);
    const newId = await this.drafts.repeat(c, id, dto);
    return ResponseWrapper.success(
      await this.orders.get(c, newId),
      'Draft saved',
    );
  }

  @Post(':id/transitions')
  @Can('lab.orders.create')
  async transition(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OrderTransitionDto,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    await this.orders.visible(c, id);
    await this.orders.transition(c, id, dto);
    return ResponseWrapper.success(await this.orders.get(c, id));
  }

  @Post(':id/revisions')
  @HttpCode(HttpStatus.CREATED)
  @Can('lab.orders.create')
  async revise(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRevisionDto,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    await this.orders.visible(c, id);
    const no = await this.orders.revise(c, id, dto);
    return ResponseWrapper.success(
      await this.orders.get(c, id),
      `Revision ${no} sent to the lab`,
    );
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @Can('lab.orders.create')
  async message(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageDto,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    await this.orders.visible(c, id);
    await this.orders.clinicMessage(c, id, dto);
    return ResponseWrapper.success(
      await this.orders.get(c, id),
      'Message sent',
    );
  }

  @Post(':id/charge-requests/:chargeId/decision')
  @Can('lab.orders.create')
  async decideCharge(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
    @Body() dto: DecideChargeDto,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    await this.orders.visible(c, id);
    await this.orders.decideCharge(c, id, chargeId, dto);
    return ResponseWrapper.success(await this.orders.get(c, id));
  }

  @Post(':id/attachments')
  @HttpCode(HttpStatus.CREATED)
  @Can('lab.orders.create')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }),
  )
  async upload(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadAttachmentDto,
  ) {
    const order = await this.orders.visible({ tenant, actor, ref }, id);
    const row = await this.attachments.upload({
      order,
      file,
      itemId: dto.itemId ?? null,
      visibility: dto.visibility ?? AttachmentVisibility.LAB_SHARED,
      side: MessageSide.CLINIC,
      userId: actor.userId,
      ref,
    });
    return ResponseWrapper.success(
      { id: row.id, fileName: row.fileName, sha256: row.sha256 },
      'File uploaded',
    );
  }

  /** A 10-minute signed download URL. */
  @Get(':id/attachments/:attachmentId/url')
  @Can('lab.orders.view')
  async attachmentUrl(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    const order = await this.orders.visible({ tenant, actor, ref }, id);
    return ResponseWrapper.success(
      await this.attachments.signedUrl(order, attachmentId, false),
    );
  }

  /** Print payload: QR + instructions, no prices. */
  @Get(':id/work-order')
  @Can('lab.orders.view')
  async workOrder(
    @ActiveTenant() tenant: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.orders.workOrder({ tenant, actor, ref }, id),
    );
  }
}
