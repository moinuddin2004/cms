import {
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import {
  AttachmentsService,
  MAX_ATTACHMENT_BYTES,
} from '../attachments/attachments.service';
import {
  CreateChargeDto,
  CreateMessageDto,
  LabOrdersQueryDto,
} from '../dto/order.dto';
import { AttachmentVisibility, MessageSide } from '../enums/order.enums';
import { LabOrdersPortalService } from '../portal/lab-orders-portal.service';
import { LabOrdersService } from '../services/lab-orders.service';

/**
 * Lab side of orders (Sprint 6 part; Sprint 7 adds accept / reject /
 * production). Scoped by `LabPortalGuard` to the member's lab; responses
 * never include clinic prices or internal files.
 */
@LabPortalController('orders')
export class LabOrdersPortalController {
  constructor(
    private readonly portal: LabOrdersPortalService,
    private readonly orders: LabOrdersService,
    private readonly attachments: AttachmentsService,
  ) {}

  @Get()
  async list(@LabActor() lab: LabActorContext, @Query() q: LabOrdersQueryDto) {
    return ResponseWrapper.success(await this.portal.list(lab, q));
  }

  @Get(':id')
  async get(
    @LabActor() lab: LabActorContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(await this.portal.get(lab, id));
  }

  /** Notes, and clarification requests (order → clarification_needed). */
  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  async message(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageDto,
  ) {
    const order = await this.portal.order(lab, id);
    await this.orders.labMessage({ lab, ref }, order, dto);
    return ResponseWrapper.success(
      await this.portal.get(lab, id),
      'Message sent',
    );
  }

  @Post(':id/revisions/:revisionNo/acknowledge')
  async acknowledge(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('revisionNo', ParseIntPipe) revisionNo: number,
  ) {
    const order = await this.portal.order(lab, id);
    await this.orders.acknowledgeRevision({ lab, ref }, order, revisionNo);
    return ResponseWrapper.success(await this.portal.get(lab, id));
  }

  @Post(':id/charge-requests')
  @HttpCode(HttpStatus.CREATED)
  @LabRoles(LabMemberRole.LAB_ADMIN)
  async requestCharge(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateChargeDto,
  ) {
    const order = await this.portal.order(lab, id);
    await this.orders.requestCharge({ lab, ref }, order, dto);
    return ResponseWrapper.success(
      await this.portal.get(lab, id),
      'Charge requested',
    );
  }

  /** Lab uploads are always shared with the clinic. */
  @Post(':id/attachments')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }),
  )
  async upload(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const order = await this.portal.order(lab, id);
    const row = await this.attachments.upload({
      order,
      file,
      visibility: AttachmentVisibility.LAB_SHARED,
      side: MessageSide.LAB,
      userId: lab.userId,
      ref,
    });
    return ResponseWrapper.success(
      { id: row.id, fileName: row.fileName, sha256: row.sha256 },
      'File uploaded',
    );
  }

  @Get(':id/attachments/:attachmentId/url')
  async attachmentUrl(
    @LabActor() lab: LabActorContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    const order = await this.portal.order(lab, id);
    return ResponseWrapper.success(
      await this.attachments.signedUrl(order, attachmentId, true),
    );
  }
}
