import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RegisterRequestDto } from 'src/auth/dto/request/register-request.dto';
import * as bcrypt from 'bcrypt';
import { ValidationFailedException } from 'src/common/exceptions/ValidationFailedException';
import { RequestContextService } from 'src/common/services/request-context.service';
import { AppLogger } from 'src/common/services/logger.service';
import { ProviderEnum } from 'src/auth/enum/ProviderEnum';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AccountStatus } from './enum/AccountStatus';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { GlobalRole } from 'src/common/enums/global-role.enum';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import {
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly context: RequestContextService,
    private readonly logger: AppLogger,
  ) { }

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
    contextUser: User,
    type: 'super_admin' | 'owner' | 'employee',
    page: number = 1,
    limit: number = 10,
    orgId?: string,
  ): Promise<PaginatedResponseDto<User>> {
    this.logger.debug(`Fetching users with type: ${type}`, UserService.name);

    // Authorization check
    if (contextUser.globalRole !== GlobalRole.SUPER_ADMIN) {
      if (!orgId) {
        throw new ForbiddenException(
          'Organization ID is required for non-super-admins',
        );
      }

      // If the contextUser is an employee, they are not allowed
      const isEmployeeContext = await this.userRepository.manager.findOne(
        Employee,
        { where: { userId: contextUser.uuid } },
      );
      if (isEmployeeContext) {
        throw new ForbiddenException('Employees cannot access user management');
      }

      // If the contextUser is owner, check they own the orgId
      const isOwnerContext = await this.userRepository.manager.findOne(
        OrganizationOwnership,
        { where: { userId: contextUser.uuid, organizationId: orgId } },
      );
      if (!isOwnerContext) {
        throw new ForbiddenException(
          'You can only view users within an organization you own',
        );
      }
    }

    const query = this.userRepository.createQueryBuilder('user');
    query.skip((page - 1) * limit).take(limit);

    if (type === 'super_admin') {
      if (contextUser.globalRole !== GlobalRole.SUPER_ADMIN) {
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
      if (contextUser.globalRole !== GlobalRole.SUPER_ADMIN && orgId) {
        query.andWhere('owner.organizationId = :orgId', { orgId });
      }
    } else if (type === 'employee') {
      query.innerJoin(Employee, 'employee', 'employee.userId = user.uuid');
      if (contextUser.globalRole !== GlobalRole.SUPER_ADMIN && orgId) {
        query.andWhere('employee.organizationId = :orgId', { orgId });
      }
    }

    const [data, total] = await query.getManyAndCount();
    return PaginatedResponseDto.create(data, total, page, limit);
  }

  async createUser(
    contextUser: User,
    body: any,
    orgId?: string,
  ): Promise<User> {
    if (contextUser.globalRole !== GlobalRole.SUPER_ADMIN) {
      if (!orgId) throw new ForbiddenException('Organization ID is required');

      const isOwnerContext = await this.userRepository.manager.findOne(
        OrganizationOwnership,
        { where: { userId: contextUser.uuid, organizationId: orgId } },
      );
      if (!isOwnerContext) {
        throw new ForbiddenException(
          'You can only create users within your organization',
        );
      }

      if (body.type === 'super_admin') {
        throw new ForbiddenException(
          'Only super admins can create super admins',
        );
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

    const hashedPassword = await bcrypt.hash(
      body.password || 'defaultPassword123',
      12,
    );
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
    contextUser: User,
    targetUserId: string,
    body: any,
    orgId?: string,
  ): Promise<User> {
    const targetUser = await this.userRepository.findOne({
      where: { uuid: targetUserId },
    });
    if (!targetUser) throw new NotFoundException('User not found');

    if (contextUser.globalRole !== GlobalRole.SUPER_ADMIN) {
      if (!orgId) throw new ForbiddenException('Organization ID is required');

      // Ensure context user is owner
      const isOwnerContext = await this.userRepository.manager.findOne(
        OrganizationOwnership,
        { where: { userId: contextUser.uuid, organizationId: orgId } },
      );
      if (!isOwnerContext) {
        throw new ForbiddenException('You do not have access');
      }

      // Ensure target user is not super admin
      if (targetUser.globalRole === GlobalRole.SUPER_ADMIN) {
        throw new ForbiddenException('Cannot modify super admins');
      }

      // Ensure target user is within the org
      const targetIsOwner = await this.userRepository.manager.findOne(
        OrganizationOwnership,
        { where: { userId: targetUserId, organizationId: orgId } },
      );
      const targetIsEmployee = await this.userRepository.manager.findOne(
        Employee,
        { where: { userId: targetUserId, organizationId: orgId } },
      );

      if (!targetIsOwner && !targetIsEmployee) {
        throw new ForbiddenException(
          'Cannot modify users outside your organization',
        );
      }

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
    if (body.status) targetUser.status = body.status;

    if (body.password) {
      targetUser.password = await bcrypt.hash(body.password, 12);
    }

    return this.userRepository.save(targetUser);
  }

  async deleteUser(
    contextUser: User,
    targetUserId: string,
    orgId?: string,
  ): Promise<{ deleted: boolean }> {
    const targetUser = await this.userRepository.findOne({
      where: { uuid: targetUserId },
    });
    if (!targetUser) throw new NotFoundException('User not found');

    if (contextUser.globalRole !== GlobalRole.SUPER_ADMIN) {
      if (!orgId) throw new ForbiddenException('Organization ID is required');

      const isOwnerContext = await this.userRepository.manager.findOne(
        OrganizationOwnership,
        { where: { userId: contextUser.uuid, organizationId: orgId } },
      );
      if (!isOwnerContext) {
        throw new ForbiddenException('You do not have access');
      }

      if (targetUser.globalRole === GlobalRole.SUPER_ADMIN) {
        throw new ForbiddenException('Cannot delete super admins');
      }

      const targetIsOwner = await this.userRepository.manager.findOne(
        OrganizationOwnership,
        { where: { userId: targetUserId, organizationId: orgId } },
      );
      const targetIsEmployee = await this.userRepository.manager.findOne(
        Employee,
        { where: { userId: targetUserId, organizationId: orgId } },
      );

      if (!targetIsOwner && !targetIsEmployee) {
        throw new ForbiddenException(
          'Cannot delete users outside your organization',
        );
      }
    }

    targetUser.deletedAt = new Date();
    targetUser.status = AccountStatus.DELETED;
    await this.userRepository.save(targetUser);

    return { deleted: true };
  }
}
