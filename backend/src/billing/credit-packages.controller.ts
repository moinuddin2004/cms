import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { AccessContext } from 'src/access/access-context';
import { Access, Can } from 'src/access/decorators/access.decorators';
import { CreditPackagesService } from './credit-packages.service';
import { PatientCreditsService } from './patient-credits.service';
import {
  CreateCreditPackageDto,
  UpdateCreditPackageDto,
  PurchaseCreditDto,
  UseCreditDto,
} from './dto/credit-package.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

/** No permission belongs to `billing.credit_packages`, so the feature stays checked. */
@Controller('credit-packages')
@RequireFeature('billing.credit_packages')
export class CreditPackagesController {
  constructor(private readonly packagesService: CreditPackagesService) {}

  @Post()
  @Can('admin.settings.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCreditPackageDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.packagesService.create(ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Credit package created successfully');
  }

  @Get()
  @Can('billing.desk.use')
  async findAll(@ActiveTenant() ctx: TenantContext) {
    const data = await this.packagesService.findAll(ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Patch(':id')
  @Can('admin.settings.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCreditPackageDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.packagesService.update(id, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Credit package updated successfully');
  }

  @Delete(':id')
  @Can('admin.settings.manage')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.packagesService.deactivate(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Credit package deactivated');
  }
}

@Controller('patients/:patientId/credits')
@RequireFeature('billing.credit_packages')
export class PatientCreditsController {
  constructor(private readonly creditsService: PatientCreditsService) {}

  @Post()
  @Can('billing.payment.collect')
  @HttpCode(HttpStatus.CREATED)
  async purchase(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: PurchaseCreditDto,
    @ActiveTenant() ctx: TenantContext,
    @Access() a: AccessContext,
  ) {
    const data = await this.creditsService.purchasePackage(
      patientId,
      dto.creditPackageId,
      ctx.organizationId,
      a.userId,
    );
    return ResponseWrapper.success(data, 'Package purchased successfully');
  }

  @Get()
  @Can('billing.desk.use')
  async list(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.creditsService.getPatientCredits(
      patientId,
      ctx.organizationId,
    );
    return ResponseWrapper.success(data);
  }

  @Post(':creditId/use')
  @Can('billing.payment.collect')
  async use(
    @Param('creditId', ParseUUIDPipe) creditId: string,
    @Body() dto: UseCreditDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.creditsService.useCredit(
      creditId,
      ctx.organizationId,
      dto.amount,
    );
    return ResponseWrapper.success(data, 'Credit applied successfully');
  }
}
