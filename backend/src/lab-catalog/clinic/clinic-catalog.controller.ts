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
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { CurrentActor, Roles } from 'src/common/decorators/roles.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { Actor, ALL_APP_ROLES, AppRole } from 'src/common/enums/app-role.enum';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { PageQueryDto } from 'src/labs/dto/lab.dto';
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
 * The clinic side of the lab catalog. Every clinic role reads it (doctors
 * pick services and see prices when ordering); only clinic admins change
 * the treatment mappings. Doctors keep their own order templates.
 */
@Controller('lab-catalog')
@RequireFeature(LAB_FEATURE)
export class ClinicCatalogController {
  constructor(
    private readonly catalog: ClinicCatalogService,
    private readonly resolver: LabPriceResolver,
    private readonly mappings: ServiceMappingsService,
    private readonly templates: OrderTemplatesService,
  ) {}

  @Get('categories')
  @Roles(...ALL_APP_ROLES)
  async categories(@ActiveTenant() t: TenantContext) {
    return ResponseWrapper.success(
      await this.catalog.categories(t.organizationId),
    );
  }

  @Get('services')
  @Roles(...ALL_APP_ROLES)
  async services(
    @ActiveTenant() t: TenantContext,
    @Query() q: ClinicLabServicesQueryDto,
  ) {
    return ResponseWrapper.success(await this.catalog.list(t, q));
  }

  @Get('services/:id')
  @Roles(...ALL_APP_ROLES)
  async service(
    @ActiveTenant() t: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(await this.catalog.get(t, id));
  }

  /** Lab cost + patient price of one line, as an order would snapshot it. */
  @Get('price-quote')
  @Roles(...ALL_APP_ROLES)
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
  @Roles(AppRole.CLINIC_ADMIN)
  async treatments(@ActiveTenant() t: TenantContext, @Query() q: PageQueryDto) {
    return ResponseWrapper.success(await this.catalog.treatments(t, q.search));
  }

  // ── Mappings ──────────────────────────────────────────────────────────

  @Get('mappings')
  @Roles(AppRole.CLINIC_ADMIN)
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
  @Roles(AppRole.CLINIC_ADMIN)
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
  @Roles(AppRole.CLINIC_ADMIN)
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
  @Roles(...ALL_APP_ROLES)
  async listTemplates(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() actor: Actor,
    @Query() q: ListTemplatesQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.templates.list(t.organizationId, actor, q),
    );
  }

  @Get('order-templates/:id')
  @Roles(...ALL_APP_ROLES)
  async getTemplate(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.templates.get(t.organizationId, actor, id),
    );
  }

  @Post('order-templates')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...ALL_APP_ROLES)
  async createTemplate(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) ref: ActorRef,
    @Body() dto: CreateTemplateDto,
  ) {
    return ResponseWrapper.success(
      await this.templates.create(t.organizationId, actor, ref, dto),
      'Template saved',
    );
  }

  @Patch('order-templates/:id')
  @Roles(...ALL_APP_ROLES)
  async updateTemplate(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() actor: Actor,
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
  @Roles(...ALL_APP_ROLES)
  async useTemplate(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.templates.use(t.organizationId, actor, id),
    );
  }
}
