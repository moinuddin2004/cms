import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { RequireSuperAdmin } from 'src/common/decorators/require-super-admin.decorator';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { PLANS } from './plans';
import { SubscriptionsService } from './subscriptions.service';
import {
  PaymentInstructionsDto,
  RecordSubscriptionPaymentDto,
  UpdateSubscriptionDto,
} from './dto/subscription.dto';

/** Super admin: every clinic's subscription, manual payments, platform text. */
@Controller('admin/subscriptions')
@RequireSuperAdmin()
export class AdminSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  async list() {
    return ResponseWrapper.success(
      { plans: Object.values(PLANS), clinics: await this.subscriptions.list() },
      'Subscriptions retrieved',
    );
  }

  @Get('payment-instructions')
  async getInstructions() {
    return ResponseWrapper.success(
      { text: await this.subscriptions.paymentInstructions() },
      'Payment instructions retrieved',
    );
  }

  @Put('payment-instructions')
  async setInstructions(
    @Body() dto: PaymentInstructionsDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      { text: await this.subscriptions.setPaymentInstructions(dto.text, actor) },
      'Payment instructions saved',
    );
  }

  @Get(':orgId')
  async get(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const [summary, payments] = await Promise.all([
      this.subscriptions.summary(orgId),
      this.subscriptions.payments(orgId),
    ]);
    return ResponseWrapper.success(
      { ...summary, plans: Object.values(PLANS), payments },
      'Subscription retrieved',
    );
  }

  @Patch(':orgId')
  async update(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: UpdateSubscriptionDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.subscriptions.update(orgId, dto, actor),
      'Subscription updated',
    );
  }

  @Post(':orgId/payments')
  async recordPayment(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: RecordSubscriptionPaymentDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.subscriptions.recordPayment(orgId, dto, actor),
      'Payment recorded',
    );
  }
}
