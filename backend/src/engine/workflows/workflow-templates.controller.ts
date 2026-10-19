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
import { RequireSuperAdmin } from 'src/common/decorators/require-super-admin.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import {
  CreateDraftDto,
  CreateStageTemplateDto,
  CreateWorkflowTemplateDto,
  ListStageTemplatesQueryDto,
  ListWorkflowTemplatesQueryDto,
  UpdateStageTemplateDto,
  UpdateWorkflowDraftDto,
  UpdateWorkflowTemplateDto,
  VersionActionDto,
} from '../dto/engine.dto';
import { EffectRegistry } from '../runtime/effect-registry';
import { StageTemplatesService } from '../stages/stage-templates.service';
import { WorkflowTemplatesService } from './workflow-templates.service';

/** Workflow templates and versions — super admins only (lab ERD §18). */
@Controller('platform/workflow-templates')
@RequireSuperAdmin()
export class PlatformWorkflowTemplatesController {
  constructor(private readonly workflows: WorkflowTemplatesService) {}

  @Get()
  async list(@Query() q: ListWorkflowTemplatesQueryDto) {
    return ResponseWrapper.success(await this.workflows.list(q));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateWorkflowTemplateDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.workflows.create(dto, actor),
      'Workflow created as a draft',
    );
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return ResponseWrapper.success(await this.workflows.get(id));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowTemplateDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.workflows.update(id, dto, actor),
      'Workflow updated',
    );
  }

  @Post(':id/versions')
  @HttpCode(HttpStatus.CREATED)
  async createDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDraftDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.workflows.createDraft(id, dto, actor),
      'Draft created',
    );
  }

  /** Definition, publish issues and a test run (path to every terminal state). */
  @Get(':id/versions/:versionId')
  async getVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return ResponseWrapper.success(
      await this.workflows.getVersion(id, versionId),
    );
  }

  @Patch(':id/versions/:versionId')
  async updateDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: UpdateWorkflowDraftDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.workflows.updateDraft(id, versionId, dto, actor),
      'Draft saved',
    );
  }

  @Delete(':id/versions/:versionId')
  async discardDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    await this.workflows.discardDraft(id, versionId, actor);
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
      await this.workflows.publish(id, versionId, dto.version, actor),
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
      await this.workflows.retire(id, versionId, dto.version, actor),
      'Version retired',
    );
  }
}

/** Stage templates — super admins only. */
@Controller('platform/stage-templates')
@RequireSuperAdmin()
export class PlatformStageTemplatesController {
  constructor(private readonly stages: StageTemplatesService) {}

  @Get()
  async list(@Query() q: ListStageTemplatesQueryDto) {
    return ResponseWrapper.success(await this.stages.list(q));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateStageTemplateDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.stages.create(dto, actor),
      'Stage template created',
    );
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return ResponseWrapper.success(await this.stages.get(id));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStageTemplateDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.stages.update(id, dto, actor),
      'Stage template updated',
    );
  }
}

/** The effect handlers this build has (the Studio's effect dropdown). */
@Controller('platform/workflow-effects')
@RequireSuperAdmin()
export class PlatformWorkflowEffectsController {
  constructor(private readonly registry: EffectRegistry) {}

  @Get()
  list() {
    return ResponseWrapper.success(
      this.registry.all().map((h) => ({
        code: h.code,
        description: h.description,
        isFinancial: h.isFinancial,
      })),
    );
  }
}
