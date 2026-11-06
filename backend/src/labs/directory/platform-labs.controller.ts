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
import { RequireSuperAdmin } from 'src/common/decorators/require-super-admin.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import {
  AddLabMemberDto,
  CreateLabDto,
  ListLabsQueryDto,
  SetLabStatusDto,
  UpdateLabDto,
  UpdateLabMemberDto,
} from '../dto/lab.dto';
import { LabStatus } from '../enums/lab.enums';
import { LabMembersService } from '../members/lab-members.service';
import { LabsDirectoryService } from './labs-directory.service';
import { LabEmailVerificationService } from './lab-email-verification.service';

/**
 * Platform lab directory — super admins only. Labs are platform-level, so
 * there is no tenant context and no `@Roles` here (RolesGuard needs one).
 * Kept off the `/organizations` and `/locations` prefixes, which the tenant
 * guard treats as context-free before checking `@RequireSuperAdmin`.
 */
@Controller('platform/labs')
@RequireSuperAdmin()
export class PlatformLabsController {
  constructor(
    private readonly labs: LabsDirectoryService,
    private readonly members: LabMembersService,
    private readonly emailVerification: LabEmailVerificationService,
  ) {}

  @Get()
  async list(@Query() q: ListLabsQueryDto) {
    return ResponseWrapper.success(await this.labs.list(q));
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return ResponseWrapper.success(await this.labs.get(id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateLabDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.labs.create(dto, actor),
      'Lab created',
    );
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLabDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.labs.update(id, dto, actor),
      'Lab updated',
    );
  }

  @Post(':id/status')
  async setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetLabStatusDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    const data = await this.labs.setStatus(id, dto, actor);
    return ResponseWrapper.success(
      data,
      data.status === LabStatus.ACTIVE ? 'Lab activated' : 'Lab suspended',
    );
  }

  /** Email a fresh confirmation link to the lab's contact address. */
  @Post(':id/email/resend-confirmation')
  @HttpCode(HttpStatus.OK)
  async resendEmailConfirmation(@Param('id', ParseUUIDPipe) id: string) {
    const sent = await this.emailVerification.start(id);
    return ResponseWrapper.success(
      { sent },
      sent ? 'Confirmation link sent' : 'The email could not be sent',
    );
  }

  /** The super admin knows the address is right: mark it verified. */
  @Post(':id/email/verify')
  @HttpCode(HttpStatus.OK)
  async markEmailVerified(
    @Param('id', ParseUUIDPipe) id: string,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    await this.emailVerification.markVerified(id, actor.userId);
    return ResponseWrapper.success(
      await this.labs.get(id),
      'Lab email marked verified',
    );
  }

  @Get(':id/links')
  async links(@Param('id', ParseUUIDPipe) id: string) {
    return ResponseWrapper.success(await this.labs.links(id));
  }

  @Get(':id/history')
  async history(@Param('id', ParseUUIDPipe) id: string) {
    return ResponseWrapper.success(await this.labs.history(id));
  }

  @Get(':id/members')
  async listMembers(@Param('id', ParseUUIDPipe) id: string) {
    return ResponseWrapper.success(await this.members.list(id));
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddLabMemberDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.members.add(id, dto, actor),
      'Member added',
    );
  }

  @Patch(':id/members/:memberId')
  async updateMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateLabMemberDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.members.update(id, memberId, dto, actor),
      'Member updated',
    );
  }
}
