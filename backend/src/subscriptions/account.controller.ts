import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
} from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { Access, AnyMember } from 'src/access/decorators/access.decorators';
import type { AccessContext } from 'src/access/access-context';
import { PLANS } from './plans';
import { SubscriptionsService } from './subscriptions.service';
import { ClinicSetupService } from './clinic-setup.service';
import { SetupClinicDto, SetupLocationDto } from './dto/subscription.dto';

function assertOwner(access: AccessContext) {
  if (!access.isOwner && !access.isSuperAdmin) {
    throw new ForbiddenException('Only the clinic owner can do this');
  }
}

/**
 * The active clinic's own account: subscription summary (everyone sees the
 * status, owners also see payments) and the one-time setup wizard (owners).
 * Exempt from SubscriptionGuard so an expired clinic can still finish setup.
 */
@Controller('account')
export class AccountController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly setup: ClinicSetupService,
  ) {}

  @Get()
  @AnyMember()
  async summary(@Access() access: AccessContext) {
    const orgId = access.organizationId;
    const isOwner = access.isOwner || access.isSuperAdmin;
    const [summary, setup] = await Promise.all([
      this.subscriptions.summary(orgId),
      this.setup.get(orgId),
    ]);
    return ResponseWrapper.success(
      {
        ...summary,
        isOwner,
        onboardingPending: setup.onboardingPending,
        plans: isOwner ? Object.values(PLANS) : [],
        paymentInstructions: isOwner
          ? await this.subscriptions.paymentInstructions()
          : null,
        payments: isOwner ? await this.subscriptions.payments(orgId) : [],
      },
      'Account retrieved',
    );
  }

  @Get('setup')
  @AnyMember()
  async getSetup(@Access() access: AccessContext) {
    assertOwner(access);
    return ResponseWrapper.success(
      await this.setup.get(access.organizationId),
      'Setup retrieved',
    );
  }

  @Patch('setup/clinic')
  @AnyMember()
  async saveClinic(
    @Access() access: AccessContext,
    @Body() dto: SetupClinicDto,
  ) {
    assertOwner(access);
    return ResponseWrapper.success(
      await this.setup.saveClinic(access.organizationId, dto),
      'Clinic details saved',
    );
  }

  @Patch('setup/location')
  @AnyMember()
  async saveLocation(
    @Access() access: AccessContext,
    @Body() dto: SetupLocationDto,
  ) {
    assertOwner(access);
    return ResponseWrapper.success(
      await this.setup.saveLocation(access.organizationId, dto),
      'Location saved',
    );
  }

  @Post('setup/complete')
  @AnyMember()
  async complete(@Access() access: AccessContext) {
    assertOwner(access);
    return ResponseWrapper.success(
      await this.setup.complete(access.organizationId),
      'Setup complete',
    );
  }
}
