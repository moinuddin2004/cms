import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormSchema } from './entities/form-schema.entity';
import { FormSchemaVersion } from './entities/form-schema-version.entity';
import { OrganizationSpecialty } from './entities/organization-specialty.entity';
import { Specialty } from './entities/specialty.entity';
import {
  StageTemplate,
  StageTemplateStep,
} from './entities/stage-template.entity';
import {
  TransitionEffect,
  WorkflowEffect,
} from './entities/workflow-effect.entity';
import { WorkflowState } from './entities/workflow-state.entity';
import { WorkflowTemplate } from './entities/workflow-template.entity';
import { WorkflowTemplateVersion } from './entities/workflow-template-version.entity';
import { WorkflowTransition } from './entities/workflow-transition.entity';
import {
  FormSchemasController,
  PlatformFormSchemasController,
} from './forms/form-schemas.controller';
import { FormResolverService } from './forms/form-resolver.service';
import { FormSchemasService } from './forms/form-schemas.service';
import { EffectRegistry } from './runtime/effect-registry';
import { RecomputeOrderStatusEffect } from './runtime/effects/recompute-order-status.effect';
import { WorkflowEngine } from './runtime/workflow-engine.service';
import { EngineSeedService } from './seeds/engine-seed.service';
import {
  PlatformSpecialtiesController,
  SpecialtiesController,
} from './specialties/specialties.controller';
import { SpecialtiesService } from './specialties/specialties.service';
import { StageTemplatesService } from './stages/stage-templates.service';
import {
  PlatformStageTemplatesController,
  PlatformWorkflowEffectsController,
  PlatformWorkflowTemplatesController,
} from './workflows/workflow-templates.controller';
import { WorkflowTemplatesService } from './workflows/workflow-templates.service';

/**
 * Generic engine (lab ERD §3, §17): specialties, versioned forms with the
 * server-side validator (Sprint 2), versioned workflows with the
 * `transition()` runtime and effects registry, and stage templates
 * (Sprint 3). Specialty-neutral: dental lives in seed data, never in
 * `if (specialty === …)` code. Modules owning workflow-driven rows register
 * a SubjectAdapter with `WorkflowEngine`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Specialty,
      OrganizationSpecialty,
      FormSchema,
      FormSchemaVersion,
      WorkflowTemplate,
      WorkflowTemplateVersion,
      WorkflowState,
      WorkflowTransition,
      WorkflowEffect,
      TransitionEffect,
      StageTemplate,
      StageTemplateStep,
    ]),
  ],
  controllers: [
    PlatformSpecialtiesController,
    SpecialtiesController,
    PlatformFormSchemasController,
    FormSchemasController,
    PlatformWorkflowTemplatesController,
    PlatformStageTemplatesController,
    PlatformWorkflowEffectsController,
  ],
  providers: [
    SpecialtiesService,
    FormSchemasService,
    FormResolverService,
    WorkflowTemplatesService,
    StageTemplatesService,
    EffectRegistry,
    RecomputeOrderStatusEffect,
    WorkflowEngine,
    EngineSeedService,
  ],
  exports: [
    SpecialtiesService,
    FormResolverService,
    WorkflowEngine,
    EffectRegistry,
  ],
})
export class EngineModule {}
