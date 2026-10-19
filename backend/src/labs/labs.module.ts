import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabsDirectoryService } from './directory/labs-directory.service';
import { PlatformLabsController } from './directory/platform-labs.controller';
import { Lab } from './entities/lab.entity';
import { LabClinicLink } from './entities/lab-clinic-link.entity';
import { LabMember } from './entities/lab-member.entity';
import { LabLinksController } from './links/lab-links.controller';
import { LabLinksService } from './links/lab-links.service';
import { LabMembersService } from './members/lab-members.service';
import { PortalLabController } from './portal/lab-portal.controller';
import { LabPortalGuard } from './portal/lab-portal.guard';
import { LabPortalService } from './portal/lab-portal.service';

/**
 * Lab management — Sprint 1 (lab ERD §19): the platform lab directory and
 * lab staff (super admin), and each clinic's lab list (lab ↔ clinic links).
 * Orders, production and lab billing build on these in later sprints.
 *
 * Lab portal (Sprint 7 foundation): `/lab-portal/*` routes for lab staff,
 * scoped by lab via `@LabPortalController` + `LabPortalGuard` (see portal/).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Lab, LabMember, LabClinicLink])],
  controllers: [
    PlatformLabsController,
    LabLinksController,
    PortalLabController,
  ],
  providers: [
    LabsDirectoryService,
    LabMembersService,
    LabLinksService,
    LabPortalService,
    LabPortalGuard,
  ],
  exports: [LabLinksService, LabPortalGuard],
})
export class LabsModule {}
