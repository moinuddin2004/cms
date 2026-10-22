import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RegisterRequestDto } from 'src/auth/dto/request/register-request.dto';
import * as bcrypt from 'bcrypt';
import { ValidationFailedException } from 'src/common/exceptions/ValidationFailedException';
import { RequestContextService } from 'src/common/services/request-context.service';
import { AppLogger } from 'src/common/services/logger.service';
import { ProviderEnum } from 'src/auth/enum/ProviderEnum';
import { User } from './entities/user.entity';
import { SessionService } from 'src/session/session.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AccountStatus } from './enum/AccountStatus';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { GlobalRole } from 'src/common/enums/global-role.enum';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import {
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
/**
 * Who is managing users. The controller has already authorized them: a
 * super admin, or `admin.users.manage` in `organizationId`.
 */
export interface UserManager {
  isSuperAdmin: boolean;
  /** Owner of `organizationId` (may manage owner accounts). */
  isOwner: boolean;
  /** Org being managed; null only for a super admin without one. */
  organizationId: string | null;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly sessionService: SessionService,
    private readonly context: RequestContextService,
    private readonly logger: AppLogger,
  ) {}

  async createLocalUser(command: RegisterRequestDto): Promise<User> {
    const { email, password, name } = command;

    this.logger.info(`Creating local user: ${email}`, UserService.name);

    const existingUser = await this.userRepository.findOneBy({ email });
    if (existingUser) {
      this.logger.warn(`Email already exists: ${email}`, UserService.name);
      throw new ValidationFailedException('Email already registered');
    }

    if (password.length < 6) {
      this.logger.warn(
        `Weak password attempted for email: ${email}`,
        UserService.name,
      );
      throw new ValidationFailedException(
        'Password must be at least 6 characters long',
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = this.userRepository.create({
      email,
      name,
      password: hashedPassword,
      provider: ProviderEnum.LOCAL,
      globalRole: null, // Normal users have no global role
      status: AccountStatus.ACTIVE,
    });
    const savedUser = await this.userRepository.save(user);
    this.logger.info(
      `User created successfully: ${savedUser.uuid}`,
      savedUser.name,
    );
    return savedUser;
  }

  async validateUser(email: string, password: string): Promise<User> {
    this.logger.debug(`Validating user: ${email}`, UserService.name);

    const user = await this.userRepository.findOneBy({ email });
    if (!user || !(await bcrypt.compare(password, <string>user.password))) {
      this.logger.warn(`Invalid credentials for: ${email}`, UserService.name);
      throw new UnauthorizedException();
    }

    this.logger.info(`User validated successfully: ${email}`, UserService.name);
    return user;
  }

  async updateRefreshToken(userUuid: string, refreshToken: string) {
    this.logger.debug(
      `Updating refresh token for: ${userUuid}`,
      UserService.name,
    );
    await this.userRepository.update(userUuid, { refreshToken });
  }

  async updateLastAccessed(
    userUuid: string,
    organizationId: string,
    locationId: string,
  ): Promise<void> {
    await this.userRepository.update(userUuid, {
      lastAccessedOrganizationId: organizationId,
      lastAccessedLocationId: locationId,
    });
  }

  async upsertOAuthUser(oauthPayload: {
    email: string;
    name: string;
    provider: ProviderEnum;
  }): Promise<User> {
    this.logger.info(
      `Upserting OAuth user: ${oauthPayload.email}`,
      UserService.name,
    );

    let user = await this.userRepository.findOneBy({
      email: oauthPayload.email,
    });
    if (!user) {
      user = this.userRepository.create({
        ...oauthPayload,
        status: AccountStatus.ACTIVE,
      });
      user = await this.userRepository.save(user);
      this.logger.info(`OAuth user created: ${user.email}`, UserService.name);
    }

    return user;
  }

  async createOAuthUser(profile: {
    email: string;
    name: string;
    provider: ProviderEnum;
  }) {
    this.logger.info(
      `Creating new OAuth user: ${profile.email}`,
      UserService.name,
    );
    const user = this.userRepository.create({
      ...profile,
      status: AccountStatus.ACTIVE,
      globalRole: null,
    });
    return this.userRepository.save(user);
  }

  getLoggedInUser() {
    const user = this.context.getUser();

    if (!user) {
      this.logger.warn(
        'Attempted to fetch logged-in user but none found in context',
        UserService.name,
      );
      throw new UnauthorizedException('User is not authenticated');
    }

    this.logger.debug(
      `Logged-in user: ${user.email || user.uuid}`,
      UserService.name,
    );
    return user;
  }

  async findUsers(
    manager: UserManager,
    type: 'super_admin' | 'owner' | 'employee',
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<User>> {
    this.logger.debug(`Fetching users with type: ${type}`, UserService.name);

    const query = this.userRepository.createQueryBuilder('user');
    query.skip((page - 1) * limit).take(limit);
    const orgId = manager.organizationId;

    if (type === 'super_admin') {
      if (!manager.isSuperAdmin) {
        throw new ForbiddenException(
          'Only super admins can view other super admins',
        );
      }
      query.where('user.globalRole = :role', { role: GlobalRole.SUPER_ADMIN });
    } else if (type === 'owner') {
      query.innerJoin(
        OrganizationOwnership,
        'owner',
        'owner.userId = user.uuid',
      );
      if (!manager.isSuperAdmin) {
        query.andWhere('owner.organizationId = :orgId', { orgId });
      }
    } else if (type === 'employee') {
      query.innerJoin(
        EmployeeOrgLocationAssignment,
        'assignment',
        'assignment.userId = user.uuid',
      );
      if (!manager.isSuperAdmin) {
        query.andWhere('assignment.organizationId = :orgId', { orgId });
      }
    }

    const [data, total] = await query.getManyAndCount();
    return PaginatedResponseDto.create(data, total, page, limit);
  }

  async createUser(
    manager: UserManager,
    body: CreateUserDto & { status?: AccountStatus },
  ): Promise<User> {
    const orgId = manager.organizationId;
    if (!manager.isSuperAdmin) {
      if (body.type === 'super_admin') {
        throw new ForbiddenException(
          'Only super admins can create super admins',
        );
      }
      if (body.type === 'owner' && !manager.isOwner) {
        throw new ForbiddenException('Only an owner can add another owner');
      }
    }

    if (body.type === 'employee') {
      throw new ForbiddenException(
        'Employees must be created from the Employee module',
      );
    }

    let user = await this.userRepository.findOne({
      where: { email: body.email },
    });
    if (user) {
      throw new BadRequestException('User with email already exists');
    }

    if (!body.password) {
      throw new BadRequestException('Password is required');
    }
    const hashedPassword = await bcrypt.hash(body.password, 12);
    user = this.userRepository.create({
      email: body.email,
      name: body.name,
      phone: body.phone,
      password: hashedPassword,
      provider: ProviderEnum.LOCAL,
      globalRole: body.type === 'super_admin' ? GlobalRole.SUPER_ADMIN : null,
      status: body.status || AccountStatus.ACTIVE,
    });

    const savedUser = await this.userRepository.save(user);

    if (body.type === 'owner' && orgId) {
      const ownership = this.userRepository.manager.create(
        OrganizationOwnership,
        {
          userId: savedUser.uuid,
          organizationId: orgId,
          isPrimaryOwner: false,
        },
      );
      await this.userRepository.manager.save(ownership);
    }
    return savedUser;
  }

  async updateUser(
    manager: UserManager,
    targetUserId: string,
    body: UpdateUserDto & { type?: string },
  ): Promise<User> {
    const targetUser = await this.userRepository.findOne({
      where: { uuid: targetUserId },
    });
    if (!targetUser) throw new NotFoundException('User not found');

    if (!manager.isSuperAdmin) {
      await this.assertManageable(manager, targetUser, 'modify');

      if (
        body.type === 'super_admin' ||
        body.globalRole === GlobalRole.SUPER_ADMIN
      ) {
        throw new ForbiddenException('Cannot elevate to super admin');
      }
    }

    if (body.email) targetUser.email = body.email;
    if (body.name) targetUser.name = body.name;
    if (body.phone) targetUser.phone = body.phone;
    if (body.status) targetUser.status = body.status as AccountStatus;

    if (body.password) {
      targetUser.password = await bcrypt.hash(body.password, 12);
    }

    return this.userRepository.save(targetUser);
  }

  async deleteUser(
    manager: UserManager,
    targetUserId: string,
  ): Promise<{ deleted: boolean }> {
    const targetUser = await this.userRepository.findOne({
      where: { uuid: targetUserId },
    });
    if (!targetUser) throw new NotFoundException('User not found');

    if (!manager.isSuperAdmin) {
      await this.assertManageable(manager, targetUser, 'delete');
    }

    targetUser.deletedAt = new Date();
    targetUser.status = AccountStatus.DELETED;
    await this.userRepository.save(targetUser);

    // Revoke all active sessions for the deleted user
    await this.sessionService.revokeAllSessions(targetUserId);

    return { deleted: true };
  }

  /**
   * A non-super-admin manager may only touch users of their organization,
   * never a super admin, and an owner account only when they are an owner
   * themselves (so `admin.users.manage` can't take over an owner login).
   */
  private async assertManageable(
    manager: UserManager,
    target: User,
    verb: 'modify' | 'delete',
  ): Promise<void> {
    const orgId = manager.organizationId;
    if (target.globalRole === GlobalRole.SUPER_ADMIN) {
      throw new ForbiddenException(`Cannot ${verb} super admins`);
    }
    const targetIsOwner = await this.userRepository.manager.findOne(
      OrganizationOwnership,
      { where: { userId: target.uuid, organizationId: orgId! } },
    );
    const targetIsEmployee = await this.userRepository.manager.findOne(
      EmployeeOrgLocationAssignment,
      { where: { userId: target.uuid, organizationId: orgId! } },
    );
    if (!targetIsOwner && !targetIsEmployee) {
      throw new ForbiddenException(
        `Cannot ${verb} users outside your organization`,
      );
    }
    if (targetIsOwner && !manager.isOwner) {
      throw new ForbiddenException(`Only an owner can ${verb} an owner`);
    }
  }
}
