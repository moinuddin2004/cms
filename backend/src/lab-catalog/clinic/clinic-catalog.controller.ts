import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AnyMember, Can } from 'src/access/decorators/access.decorators';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { PageQueryDto } from 'src/labs/dto/lab.dto';
import { ClinicActor, CurrentClinicActor } from 'src/labs/common/clinic-actor';
import { LAB_FEATURE } from 'src/labs/labs.constants';
import {
  ClinicLabServicesQueryDto,
  CreateMappingDto,
  CreateTemplateDto,
  ListMappingsQueryDto,
  ListTemplatesQueryDto,
  PriceQuoteQueryDto,
  UpdateMappingDto,
  UpdateTemplateDto,
} from '../dto/catalog.dto';
import { ServiceMappingsService } from '../mappings/service-mappings.service';
import { LabPriceResolver } from '../pricing/lab-price-resolver.service';
import { OrderTemplatesService } from '../templates/order-templates.service';
import { ClinicCatalogService } from './clinic-catalog.service';

/**
 * The clinic side of the lab catalog. Every clinic member reads it (doctors
 * pick services and see prices when ordering; the `@AnyMember` reads keep
 * the lab feature gate); `lab.catalog.manage` changes the clinic price list
 * (treatment mappings). Order templates belong to whoever orders
 * (`lab.orders.create`); sharing one needs `lab.templates.share`.
 */
@Controller('lab-catalog')
export class ClinicCatalogController {
  constructor(
    private readonly catalog: ClinicCatalogService,
    private readonly resolver: LabPriceResolver,
    private readonly mappings: ServiceMappingsService,
    private readonly templates: OrderTemplatesService,
  ) {}

  @Get('categories')
  @AnyMember()
  @RequireFeature(LAB_FEATURE)
  async categories(@ActiveTenant() t: TenantContext) {
    return ResponseWrapper.success(
      await this.catalog.categories(t.organizationId),
    );
  }

  @Get('services')
  @AnyMember()
  @RequireFeature(LAB_FEATURE)
  async services(
    @ActiveTenant() t: TenantContext,
    @Query() q: ClinicLabServicesQueryDto,
  ) {
    return ResponseWrapper.success(await this.catalog.list(t, q));
  }

  @Get('services/:id')
  @AnyMember()
  @RequireFeature(LAB_FEATURE)
  async service(
    @ActiveTenant() t: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(await this.catalog.get(t, id));
  }

  /** Lab cost + patient price of one line, as an order would snapshot it. */
  @Get('price-quote')
  @AnyMember()
  @RequireFeature(LAB_FEATURE)
  async quote(
    @ActiveTenant() t: TenantContext,
    @Query() q: PriceQuoteQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.resolver.quote({
        organizationId: t.organizationId,
        locationId: t.locationId,
        labServiceId: q.labServiceId,
        optionIds: q.optionIds,
        rush: q.rush,
        on: q.on,
        clinicTreatmentId: q.clinicTreatmentId,
        doctorId: q.doctorId,
      }),
    );
  }

  /** The clinic's treatments (billing catalog) with patient prices. */
  @Get('treatments')
  @Can('lab.catalog.manage')
  async treatments(@ActiveTenant() t: TenantContext, @Query() q: PageQueryDto) {
    return ResponseWrapper.success(await this.catalog.treatments(t, q.search));
  }

  // ── Mappings ──────────────────────────────────────────────────────────

  @Get('mappings')
  @Can('lab.catalog.manage')
  async listMappings(
    @ActiveTenant() t: TenantContext,
    @Query() q: ListMappingsQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.mappings.list(t.organizationId, q),
    );
  }

  @Post('mappings')
  @HttpCode(HttpStatus.CREATED)
  @Can('lab.catalog.manage')
  async createMapping(
    @ActiveTenant() t: TenantContext,
    @Body() dto: CreateMappingDto,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.mappings.create(t.organizationId, dto, actor),
      'Mapping saved',
    );
  }

  @Patch('mappings/:id')
  @Can('lab.catalog.manage')
  async updateMapping(
    @ActiveTenant() t: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMappingDto,
    @RequestActor(ActorSide.CLINIC) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.mappings.update(t.organizationId, id, dto, actor),
      'Mapping updated',
    );
  }

  // ── Order templates ───────────────────────────────────────────────────

  @Get('order-templates')
  @Can('lab.orders.create')
  async listTemplates(
    @ActiveTenant() t: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @Query() q: ListTemplatesQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.templates.list(t.organizationId, actor, q),
    );
  }

  @Get('order-templates/:id')
  @Can('lab.orders.create')
  async getTemplate(
    @ActiveTenant() t: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.templates.get(t.organizationId, actor, id),
    );
  }

  @Post('order-templates')
  @HttpCode(HttpStatus.CREATED)
  @Can('lab.orders.create')
  async createTemplate(
    @ActiveTenant() t: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Body() dto: CreateTemplateDto,
  ) {
    return ResponseWrapper.success(
      await this.templates.create(t.organizationId, actor, ref, dto),
      'Template saved',
    );
  }

  @Patch('order-templates/:id')
  @Can('lab.orders.create')
  async updateTemplate(
    @ActiveTenant() t: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return ResponseWrapper.success(
      await this.templates.update(t.organizationId, actor, ref, id, dto),
      'Template updated',
    );
  }

  @Post('order-templates/:id/use')
  @Can('lab.orders.create')
  async useTemplate(
    @ActiveTenant() t: TenantContext,
    @CurrentClinicActor() actor: ClinicActor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.templates.use(t.organizationId, actor, id),
    );
  }
}
