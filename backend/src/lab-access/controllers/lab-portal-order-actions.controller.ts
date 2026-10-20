import { Body, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { labTransitionActor } from 'src/lab-orders/common/order-context';
import { LabOrdersPortalService } from 'src/lab-orders/portal/lab-orders-portal.service';
import { LabMemberRole } from 'src/labs/enums/lab.enums';
import {
  LabActor,
  LabPortalController,
  LabRoles,
} from 'src/labs/portal/lab-actor';
import type { LabActorContext } from 'src/labs/portal/lab-portal.constants';
import {
  LabOrderActionsService,
  LabSideCall,
} from '../actions/lab-order-actions.service';
import {
  AcceptOrderDto,
  ClarificationDto,
  ExpectedDateDto,
  RejectOrderDto,
} from '../dto/lab-access.dto';

/**
 * Lab portal answers to an order (lab ERD §10 "Lab accept", §14 step 5):
 * accept with the expected date, reject, ask for clarification, move the
 * date. The order is looked up within the member's lab (`LabScopedService`)
 * — another lab's id is a 404. Roles come from the pinned workflow
 * (default: lab_admin) via `transition()`; status_history gets `via = portal`.
 */
@LabPortalController('orders')
export class LabPortalOrderActionsController {
  constructor(
    private readonly portal: LabOrdersPortalService,
    private readonly actions: LabOrderActionsService,
  ) {}

  @Get(':id/actions')
  async available(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const order = await this.portal.order(lab, id);
    return ResponseWrapper.success({
      actions: await this.actions.available(order, this.call(lab, ref)),
    });
  }

  @Post(':id/accept')
  async accept(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptOrderDto,
  ) {
    const order = await this.portal.order(lab, id);
    await this.actions.accept(order, dto, this.call(lab, ref));
    return ResponseWrapper.success(
      await this.portal.get(lab, id),
      'Order accepted',
    );
  }

  @Post(':id/reject')
  async reject(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectOrderDto,
  ) {
    const order = await this.portal.order(lab, id);
    await this.actions.reject(order, dto, this.call(lab, ref));
    return ResponseWrapper.success(
      await this.portal.get(lab, id),
      'Order rejected',
    );
  }

  @Post(':id/clarification')
  async clarify(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClarificationDto,
  ) {
    const order = await this.portal.order(lab, id);
    await this.actions.clarify(order, dto, this.call(lab, ref));
    return ResponseWrapper.success(
      await this.portal.get(lab, id),
      'Question sent',
    );
  }

  @Post(':id/expected-date')
  @LabRoles(LabMemberRole.LAB_ADMIN)
  async expectedDate(
    @LabActor() lab: LabActorContext,
    @RequestActor(ActorSide.LAB) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExpectedDateDto,
  ) {
    const order = await this.portal.order(lab, id);
    await this.actions.changeExpectedDate(order, dto, this.call(lab, ref));
    return ResponseWrapper.success(
      await this.portal.get(lab, id),
      'Expected date changed',
    );
  }

  private call(lab: LabActorContext, ref: ActorRef): LabSideCall {
    return {
      actor: labTransitionActor({ lab, ref }),
      onBehalfOfLabId: null,
      ref,
      authorUserId: lab.userId,
    };
  }
}
