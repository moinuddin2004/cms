import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { isIP } from 'net';
import { DataSource, EntityManager } from 'typeorm';
import {
  ActorRef,
  ActorSide,
  TransitionVia,
} from 'src/common/audit/audit.enums';
import { Public } from 'src/common/decorators/publicDecorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import type { AppRequest } from 'src/common/types/app-request';
import { AttachmentsService } from 'src/lab-orders/attachments/attachments.service';
import { toLabOrder } from 'src/lab-orders/mappers/order-response';
import { OrderReaderService } from 'src/lab-orders/services/order-reader.service';
import { LabMemberRole } from 'src/labs/enums/lab.enums';
import {
  LabOrderActionsService,
  LabSideCall,
} from '../actions/lab-order-actions.service';
import { accessError } from '../common/access-errors';
import {
  AcceptOrderDto,
  ClarificationDto,
  RejectOrderDto,
} from '../dto/lab-access.dto';
import { MagicLink, MagicLinkPurpose } from '../entities/magic-link.entity';
import { LabOrder } from 'src/lab-orders/entities/lab-order.entity';
import { MagicLinksService } from './magic-links.service';

/** Actions a magic link may take (§13: view, accept, reject, ask). */
const LINK_ACTIONS = new Set(['accept', 'reject', 'request_clarification']);

/**
 * No-login lab access (lab ERD §7, §13). The token in the path is the only
 * credential: it opens exactly one order of one lab. Lab-safe view only
 * (the lab mapper: no patient price, clinic treatment or internal files).
 * Each action is a status change with `via = magic_link`, actor side lab,
 * no user — and a dead link (expired, revoked, closed order) does nothing.
 * Paths are listed in `PUBLIC_ROUTES`.
 */
@Public()
@Controller('lab-link')
export class MagicLinkController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly links: MagicLinksService,
    private readonly actions: LabOrderActionsService,
    private readonly reader: OrderReaderService,
    private readonly attachments: AttachmentsService,
  ) {}

  @Get(':token')
  async view(@Param('token') token: string, @Req() req: AppRequest) {
    const { link, order } = await this.links.resolve(token);
    await this.links.markViewed(link.id);
    const call = this.call(link, req);
    const actions =
      link.purpose === MagicLinkPurpose.LAB_UPDATE_ORDER
        ? (await this.actions.available(order, call)).filter((a) =>
            LINK_ACTIONS.has(a),
          )
        : [];
    return ResponseWrapper.success({
      link: {
        purpose: link.purpose,
        expiresAt: link.expiresAt,
        lab: { name: order.lab.name },
      },
      actions,
      order: toLabOrder(
        await this.reader.load(order),
        order.labClinicLink.patientDataLevel,
      ),
    });
  }

  @Post(':token/accept')
  async accept(
    @Param('token') token: string,
    @Req() req: AppRequest,
    @Body() dto: AcceptOrderDto,
  ) {
    await this.act(token, req, (m, order, call) =>
      this.actions.accept(order, dto, call, m),
    );
    return ResponseWrapper.success(null, 'Order accepted');
  }

  @Post(':token/reject')
  async reject(
    @Param('token') token: string,
    @Req() req: AppRequest,
    @Body() dto: RejectOrderDto,
  ) {
    await this.act(token, req, (m, order, call) =>
      this.actions.reject(order, dto, call, m),
    );
    return ResponseWrapper.success(null, 'Order rejected');
  }

  @Post(':token/clarification')
  async clarify(
    @Param('token') token: string,
    @Req() req: AppRequest,
    @Body() dto: ClarificationDto,
  ) {
    await this.act(token, req, (m, order, call) =>
      this.actions.clarify(order, dto, call, m),
    );
    return ResponseWrapper.success(null, 'Question sent');
  }

  @Get(':token/attachments/:attachmentId/url')
  async attachmentUrl(
    @Param('token') token: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    const { order } = await this.links.resolve(token);
    return ResponseWrapper.success(
      await this.attachments.signedUrl(order, attachmentId, true),
    );
  }

  /** Resolve + lock the link, run the action, count the use — one transaction. */
  private async act(
    token: string,
    req: AppRequest,
    fn: (m: EntityManager, order: LabOrder, call: LabSideCall) => Promise<void>,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const { link, order } = await this.links.resolve(token, m, true);
      if (link.purpose !== MagicLinkPurpose.LAB_UPDATE_ORDER) {
        throw accessError(
          'MAGIC_LINK_FORBIDDEN',
          'This link can only show the order',
        );
      }
      await fn(m, order, this.call(link, req));
      await this.links.markUsed(m, link.id);
    });
  }

  /** The link acts as the lab's admin — the authority the clinic handed out. */
  private call(link: MagicLink, req: AppRequest): LabSideCall {
    const ip = req.ip && isIP(req.ip) ? req.ip : null;
    const ref: ActorRef = { userId: null, side: ActorSide.LAB, ip };
    return {
      actor: {
        userId: null,
        side: 'lab',
        roles: [LabMemberRole.LAB_ADMIN],
        via: TransitionVia.MAGIC_LINK,
        ip,
      },
      onBehalfOfLabId: null,
      ref,
      authorUserId: null,
      meta: { magic_link_id: link.id },
    };
  }
}
