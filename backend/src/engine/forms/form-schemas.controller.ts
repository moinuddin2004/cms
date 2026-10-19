import {
  Body,
  Controller,
  Delete,
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
import { RequireSuperAdmin } from 'src/common/decorators/require-super-admin.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ALL_APP_ROLES } from 'src/common/enums/app-role.enum';
import type { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import {
  CreateDraftDto,
  CreateFormSchemaDto,
  CurrentFormsQueryDto,
  ListFormSchemasQueryDto,
  UpdateDraftDto,
  UpdateFormSchemaDto,
  ValidateFormDataDto,
  VersionActionDto,
} from '../dto/engine.dto';
import { FormResolverService } from './form-resolver.service';
import { FormSchemasService } from './form-schemas.service';

/**
 * Form schemas and versions — super admins only (Configuration Studio is
 * platform-only in phase 1, lab ERD §18).
 */
@Controller('platform/form-schemas')
@RequireSuperAdmin()
export class PlatformFormSchemasController {
  constructor(private readonly forms: FormSchemasService) {}

  @Get()
  async list(@Query() q: ListFormSchemasQueryDto) {
    return ResponseWrapper.success(await this.forms.list(q));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateFormSchemaDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.forms.create(dto, actor),
      'Form created as a draft',
    );
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return ResponseWrapper.success(await this.forms.get(id));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFormSchemaDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.forms.update(id, dto, actor),
      'Form updated',
    );
  }

  @Get(':id/history')
  async history(@Param('id', ParseUUIDPipe) id: string) {
    return ResponseWrapper.success(await this.forms.history(id));
  }

  @Post(':id/versions')
  @HttpCode(HttpStatus.CREATED)
  async createDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDraftDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.forms.createDraft(id, dto, actor),
      'Draft created',
    );
  }

  @Get(':id/versions/:versionId')
  async getVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return ResponseWrapper.success(await this.forms.getVersion(id, versionId));
  }

  @Patch(':id/versions/:versionId')
  async updateDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: UpdateDraftDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.forms.updateDraft(id, versionId, dto, actor),
      'Draft saved',
    );
  }

  @Delete(':id/versions/:versionId')
  async discardDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    await this.forms.discardDraft(id, versionId, actor);
    return ResponseWrapper.success(null, 'Draft discarded');
  }

  @Post(':id/versions/:versionId/publish')
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: VersionActionDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.forms.publish(id, versionId, dto.version, actor),
      'Version published',
    );
  }

  @Post(':id/versions/:versionId/retire')
  async retire(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: VersionActionDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.forms.retire(id, versionId, dto.version, actor),
      'Version retired',
    );
  }

  /** Try answers against any version, drafts included (preview / test run). */
  @Post(':id/versions/:versionId/validate')
  @HttpCode(HttpStatus.OK)
  async validate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: ValidateFormDataDto,
  ) {
    return ResponseWrapper.success(
      await this.forms.validateData(id, versionId, dto.data),
    );
  }
}

/** Forms as the active organization sees them. */
@Controller('form-schemas')
export class FormSchemasController {
  constructor(private readonly resolver: FormResolverService) {}

  @Get()
  @Roles(...ALL_APP_ROLES)
  async current(
    @ActiveTenant() t: TenantContext,
    @Query() q: CurrentFormsQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.resolver.current(t.organizationId, q.specialty),
    );
  }

  @Get('versions/:versionId')
  @Roles(...ALL_APP_ROLES)
  async version(
    @ActiveTenant() t: TenantContext,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return ResponseWrapper.success(
      await this.resolver.version(t.organizationId, versionId),
    );
  }

  @Post('versions/:versionId/validate')
  @HttpCode(HttpStatus.OK)
  @Roles(...ALL_APP_ROLES)
  async validate(
    @ActiveTenant() t: TenantContext,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: ValidateFormDataDto,
  ) {
    return ResponseWrapper.success(
      await this.resolver.validate(t.organizationId, versionId, dto.data),
    );
  }
}
