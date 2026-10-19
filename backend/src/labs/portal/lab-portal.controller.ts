import {
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import type { AppRequest } from 'src/common/types/app-request';
import {
  AddLabMemberDto,
  LabLinkTransitionDto,
  UpdateLabMemberDto,
} from '../dto/lab.dto';
import { LabMemberRole } from '../enums/lab.enums';
import {
  AnyLabMembership,
  LabActor,
  LabPortalController,
  LabRoles,
} from './lab-actor';
import type { LabActorContext } from './lab-portal.constants';
import { PortalClinicsQueryDto, UpdateLabContactDto } from './lab-portal.dto';
import { LabPortalService } from './lab-portal.service';

const TRANSITION_MESSAGES = {
  activate: 'Clinic accepted',
  suspend: 'Clinic suspended',
  reactivate: 'Clinic reactivated',
} as const;

/**
 * The lab portal's own lab: profile, team and linked clinics. Every route
 * is scoped to the caller's active lab by `LabPortalGuard`; reads are open
 * to any member, changes to lab admins.
 */
@LabPortalController()
export class PortalLabController {
  constructor(private readonly portal: LabPortalService) {}

  /** The labs this user can open — the portal's lab switcher. */
  @Get('me')
  @AnyLabMembership()
  async me(@Req() req: AppRequest) {
    return ResponseWrapper.success({
      labs: await this.portal.me(req.user!.uuid),
    });
  }

  @Get('lab')
  async lab(@LabActor() actor: LabActorContext) {
    return ResponseWrapper.success(await this.portal.profile(actor));
  }

  @Patch('lab')
  @LabRoles(LabMemberRole.LAB_ADMIN)
  async updateLab(
    @LabActor() actor: LabActorContext,
    @Body() dto: UpdateLabContactDto,
    @RequestActor(ActorSide.LAB) audit: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.portal.updateContact(actor, dto, audit),
      'Lab details updated',
    );
  }

  @Get('members')
  @LabRoles(LabMemberRole.LAB_ADMIN)
  async members(@LabActor() actor: LabActorContext) {
    return ResponseWrapper.success(await this.portal.listMembers(actor));
  }

  @Post('members')
  @HttpCode(HttpStatus.CREATED)
  @LabRoles(LabMemberRole.LAB_ADMIN)
  async addMember(
    @LabActor() actor: LabActorContext,
    @Body() dto: AddLabMemberDto,
    @RequestActor(ActorSide.LAB) audit: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.portal.addMember(actor, dto, audit),
      'Member added',
    );
  }

  @Patch('members/:memberId')
  @LabRoles(LabMemberRole.LAB_ADMIN)
  async updateMember(
    @LabActor() actor: LabActorContext,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateLabMemberDto,
    @RequestActor(ActorSide.LAB) audit: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.portal.updateMember(actor, memberId, dto, audit),
      'Member updated',
    );
  }

  @Get('clinics')
  async clinics(
    @LabActor() actor: LabActorContext,
    @Query() q: PortalClinicsQueryDto,
  ) {
    return ResponseWrapper.success(await this.portal.clinics(actor, q));
  }

  @Post('clinics/:linkId/transitions')
  @LabRoles(LabMemberRole.LAB_ADMIN)
  async transitionClinic(
    @LabActor() actor: LabActorContext,
    @Param('linkId', ParseUUIDPipe) linkId: string,
    @Body() dto: LabLinkTransitionDto,
    @RequestActor(ActorSide.LAB) audit: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.portal.transitionClinic(actor, linkId, dto, audit),
      TRANSITION_MESSAGES[dto.action],
    );
  }
}
