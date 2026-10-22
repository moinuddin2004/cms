import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  UseGuards,
  Req,
  Query,
  Headers,
  BadRequestException,
  Body,
  Param,
} from '@nestjs/common';
import { UserService, UserManager } from './user.service';
import { GlobalRole } from 'src/common/enums/global-role.enum';
import { AccessResolver, isUuid } from 'src/access/access.resolver';
import type { Permission } from 'src/access/catalog/permissions';
import { noPermission } from 'src/access/decorators/access.decorators';
import { AuthGuard } from '@nestjs/passport';
import { User } from './entities/user.entity';
import { UserDto } from './dto/user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ContextFree } from 'src/common/decorators/context-free.decorator';

type UserRequest = {
  user: User;
  headers: Record<string, string | string[] | undefined>;
};

/** What user management needs (super admins are exempt: platform-level). */
export const USERS_PERMISSION: Permission = 'admin.users.manage';

@ContextFree()
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly resolver: AccessResolver,
  ) {}

  /**
   * Super admin, or `admin.users.manage` in the org named by
   * `x-organization-id` (checked at the caller's active location, where
   * their role applies). Not a `@Can`: super admins may work without an
   * organization selected.
   */
  private async manager(
    req: UserRequest,
    orgId: string | undefined,
  ): Promise<UserManager> {
    if (req.user.globalRole === GlobalRole.SUPER_ADMIN) {
      return {
        isSuperAdmin: true,
        isOwner: false,
        organizationId: isUuid(orgId) ? orgId : null,
      };
    }
    if (!isUuid(orgId)) {
      throw new BadRequestException('Organization ID is required');
    }
    const rawLocation = req.headers['x-location-id'];
    const locationId = Array.isArray(rawLocation)
      ? rawLocation[0]
      : rawLocation;
    const access = await this.resolver.resolve(
      req.user.uuid,
      orgId,
      isUuid(locationId) ? locationId : null,
    );
    if (!access.can(USERS_PERMISSION)) throw noPermission([USERS_PERMISSION]);
    return {
      isSuperAdmin: false,
      isOwner: access.isOwner,
      organizationId: orgId,
    };
  }

  /** Any signed-in user: their own profile. */
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMe(@Req() req): Promise<UserDto> {
    return UserDto.toDto(req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getUsers(
    @Req() req: UserRequest,
    @Query('type') type: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Headers('x-organization-id') orgId: string,
  ) {
    if (!['super_admin', 'owner', 'employee'].includes(type) && type) {
      throw new BadRequestException('Invalid user type');
    }
    const manager = await this.manager(req, orgId);
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;

    return this.userService.findUsers(
      manager,
      (type || 'employee') as 'super_admin' | 'owner' | 'employee',
      pageNumber,
      limitNumber,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async createUser(
    @Req() req: UserRequest,
    @Body() body: CreateUserDto,
    @Headers('x-organization-id') orgId: string,
  ) {
    return this.userService.createUser(await this.manager(req, orgId), body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  async updateUser(
    @Req() req: UserRequest,
    @Param('id') targetUserId: string,
    @Body() body: UpdateUserDto,
    @Headers('x-organization-id') orgId: string,
  ) {
    return this.userService.updateUser(
      await this.manager(req, orgId),
      targetUserId,
      body,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async deleteUser(
    @Req() req: UserRequest,
    @Param('id') targetUserId: string,
    @Headers('x-organization-id') orgId: string,
  ) {
    return this.userService.deleteUser(
      await this.manager(req, orgId),
      targetUserId,
    );
  }
}
