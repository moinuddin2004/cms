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
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { CurrentActor, Roles } from 'src/common/decorators/roles.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { Actor, ALL_APP_ROLES, AppRole } from 'src/common/enums/app-role.enum';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { LAB_FEATURE } from 'src/labs/labs.constants';
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

const DOCTORS = [AppRole.CLINIC_ADMIN, AppRole.DOCTOR];

/**
 * Clinic lab orders (lab ERD §14 steps 2–5). Any clinic role reads and
 * prepares drafts; the workflow decides who may submit (doctors, clinic
 * admins) and which status actions each role has.
 */
@Controller('lab-orders')
@RequireFeature(LAB_FEATURE)
export class LabOrdersController {
  constructor(
    private readonly drafts: OrderDraftsService,
    private readonly submitter: OrderSubmitService,
    private readonly orders: LabOrdersService,
    private readonly attachments: AttachmentsService,
  ) {}

  @Get()
  @Roles(...ALL_APP_ROLES)
  async list(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
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
  @Roles(...ALL_APP_ROLES)
  async create(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
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
  @Roles(...ALL_APP_ROLES)
  async fromTemplate(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Body() dto: FromTemplateDto,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    const id = await this.drafts.fromTemplate(c, dto);
    return ResponseWrapper.success(await this.orders.get(c, id), 'Draft saved');
  }

  @Get(':id')
  @Roles(...ALL_APP_ROLES)
  async get(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.orders.get({ tenant, actor, ref }, id),
    );
  }

  @Patch(':id')
  @Roles(...ALL_APP_ROLES)
  async update(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    await this.drafts.update(c, id, dto);
    return ResponseWrapper.success(await this.orders.get(c, id), 'Draft saved');
  }

  /** Lab ERD §10 "Order submit" — `Idempotency-Key` required. */
  @Post(':id/submit')
  @Roles(...ALL_APP_ROLES)
  async submit(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionDto,
    @Headers('idempotency-key') key?: string,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    const result = await this.submitter.submit(c, id, dto.version, key);
    return ResponseWrapper.success(
      { ...(await this.orders.get(c, id)), replayed: result.replayed },
      `Order ${result.orderNo} submitted`,
    );
  }

  @Post(':id/repeat')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...ALL_APP_ROLES)
  async repeat(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RepeatOrderDto,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    const newId = await this.drafts.repeat(c, id, dto);
    return ResponseWrapper.success(
      await this.orders.get(c, newId),
      'Draft saved',
    );
  }

  @Post(':id/transitions')
  @Roles(...ALL_APP_ROLES)
  async transition(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OrderTransitionDto,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    await this.orders.transition(c, id, dto);
    return ResponseWrapper.success(await this.orders.get(c, id));
  }

  @Post(':id/revisions')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...DOCTORS)
  async revise(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRevisionDto,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    const no = await this.orders.revise(c, id, dto);
    return ResponseWrapper.success(
      await this.orders.get(c, id),
      `Revision ${no} sent to the lab`,
    );
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...ALL_APP_ROLES)
  async message(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageDto,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    await this.orders.clinicMessage(c, id, dto);
    return ResponseWrapper.success(
      await this.orders.get(c, id),
      'Message sent',
    );
  }

  @Post(':id/charge-requests/:chargeId/decision')
  @Roles(...DOCTORS)
  async decideCharge(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
    @Body() dto: DecideChargeDto,
  ) {
    const c: ClinicCall = { tenant, actor, ref };
    await this.orders.decideCharge(c, id, chargeId, dto);
    return ResponseWrapper.success(await this.orders.get(c, id));
  }

  @Post(':id/attachments')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...ALL_APP_ROLES)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }),
  )
  async upload(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadAttachmentDto,
  ) {
    const order = await this.orders.byId(tenant.organizationId, id);
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
  @Roles(...ALL_APP_ROLES)
  async attachmentUrl(
    @ActiveTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    const order = await this.orders.byId(tenant.organizationId, id);
    return ResponseWrapper.success(
      await this.attachments.signedUrl(order, attachmentId, false),
    );
  }

  /** Print payload: QR + instructions, no prices. */
  @Get(':id/work-order')
  @Roles(...ALL_APP_ROLES)
  async workOrder(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.orders.workOrder({ tenant, actor, ref }, id),
    );
  }
}
