import { StorageService } from 'src/common/storage/storage.service';
import { staffRecipient } from 'src/notifications/recipients/staff-recipients';
import { NotificationService } from 'src/notifications/services/notification.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RegisterRequestDto } from 'src/auth/dto/request/register-request.dto';
import * as bcrypt from 'bcrypt';
import { ValidationFailedException } from 'src/common/exceptions/ValidationFailedException';
import { RequestContextService } from 'src/common/services/request-context.service';
import { AppLogger } from 'src/common/services/logger.service';
import { ProviderEnum } from 'src/auth/enum/ProviderEnum';
import { User } from './entities/user.entity';
import { EmailVerificationService } from './email-verification.service';
import { SubscriptionsService } from 'src/subscriptions/subscriptions.service';
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

/** bcrypt hash of a random string (cost 12, like real ones) for constant-time login failures. */
const DUMMY_HASH =
  '$2b$12$xR13jeQq.uhSNBa5jVf1AOGYLGN8aINHoHbF0BbuhBTpgku/UDoCG';
import {
  ForbiddenException,
  BadRequestException,
  ConflictException,
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
    private readonly subscriptions: SubscriptionsService,
    private readonly verification: EmailVerificationService,
    private readonly notifications: NotificationService,
    private readonly storage: StorageService,
  ) {}

  /**
   * The signed-in user's own profile photo: validated image (real type from
   * its bytes, max 2 MB), stored publicly under users/<uuid>/. The previous
   * uploaded photo is deleted after the new one is saved.
   */
  async setAvatar(
    userUuid: string,
    file: Express.Multer.File | undefined,
  ): Promise<User> {
    const user = await this.userRepository.findOneByOrFail({ uuid: userUuid });
    const uploaded = await this.storage.uploadPublic(
      file,
      'avatar',
      `users/${userUuid}/avatar`,
    );
    const previousKey = user.avatarKey;
    user.avatarUrl = uploaded.url;
    user.avatarKey = uploaded.key;
    const saved = await this.userRepository.save(user);
    await this.storage.delete(previousKey);
    return saved;
  }

  /** Removes the user's own profile photo (back to initials). */
  async removeAvatar(userUuid: string): Promise<User> {
    const user = await this.userRepository.findOneByOrFail({ uuid: userUuid });
    await this.userRepository.update(
      { uuid: userUuid },
      { avatarUrl: () => 'NULL', avatarKey: null },
    );
    await this.storage.delete(user.avatarKey);
    return this.userRepository.findOneByOrFail({ uuid: userUuid });
  }

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
    const user = await this.userRepository.findOneBy({ email });
    // Always run one bcrypt compare (against a dummy hash when there is no
    // account / no password), so response time doesn't reveal which emails
    // have accounts. Google-only accounts: same answer as a wrong password.
    const ok = await bcrypt.compare(password, user?.password || DUMMY_HASH);
    if (!user || !user.password || !ok) {
      this.logger.warn('Invalid credentials', UserService.name);
      throw new UnauthorizedException();
    }
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

  /** Case-insensitive email lookup (Google emails are lower-cased). */
  findByEmail(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .getOne();
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

    // Plan limit on logins — super admins may go over it.
    if (orgId && !manager.isSuperAdmin && body.type !== 'super_admin') {
      await this.subscriptions.assertCanAddUser(orgId);
    }

    if (body.type === 'employee') return this.createStaffLogin(manager, body);

    let user = await this.findByEmail(body.email);
    if (user) {
      // An existing account (e.g. owner of another clinic) can become an
      // owner here too — it keeps its own password / Google sign-in.
      if (
        body.type === 'owner' &&
        orgId &&
        user.globalRole !== GlobalRole.SUPER_ADMIN
      ) {
        const already = await this.userRepository.manager.exists(
          OrganizationOwnership,
          { where: { userId: user.uuid, organizationId: orgId } },
        );
        if (already) {
          throw new ConflictException('This person is already an owner');
        }
        await this.userRepository.manager.save(
          this.userRepository.manager.create(OrganizationOwnership, {
            userId: user.uuid,
            organizationId: orgId,
            isPrimaryOwner: false,
          }),
        );
        return user;
      }
      throw new BadRequestException('User with email already exists');
    }

    // Super admins always sign in with a password.
    const google = body.loginMethod === 'google' && body.type !== 'super_admin';
    if (!google && !body.password) {
      throw new BadRequestException('Password is required');
    }
    user = this.userRepository.create({
      email: google ? body.email.toLowerCase() : body.email,
      name: body.name,
      phone: body.phone,
      password: google ? undefined : await bcrypt.hash(body.password!, 12),
      provider: google ? ProviderEnum.GOOGLE : ProviderEnum.LOCAL,
      globalRole: body.type === 'super_admin' ? GlobalRole.SUPER_ADMIN : null,
      status: body.status || AccountStatus.ACTIVE,
    });

    const savedUser = await this.userRepository.save(user);
    // A new password login works only once its email is verified.
    if (savedUser.password)
      await this.verification.start(savedUser, new Date());

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

  /**
   * Staff without a login in the active org (active assignments, none linked
   * to a user yet) — the choices for a `type: 'employee'` user.
   */
  async staffCandidates(manager: UserManager) {
    const orgId = manager.organizationId;
    if (!orgId) throw new BadRequestException('Organization ID is required');
    const rows = await this.userRepository.manager
      .getRepository(EmployeeOrgLocationAssignment)
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.employee', 'e')
      .leftJoinAndSelect('a.location', 'l')
      .where('a.organization_id = :orgId AND a.is_active = true', { orgId })
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM employee_org_location_assignments x
          WHERE x.employee_id = a.employee_id AND x.organization_id = :orgId
          AND x.user_id IS NOT NULL)`,
      )
      .orderBy('e.full_name', 'ASC')
      .getMany();
    const byEmployee = new Map<
      string,
      { employeeId: string; name: string; phone: string; locations: string[] }
    >();
    for (const a of rows) {
      const entry = byEmployee.get(a.employeeId) ?? {
        employeeId: a.employeeId,
        name: a.employee.fullName,
        phone: a.employee.phone,
        locations: [],
      };
      if (a.location?.name) entry.locations.push(a.location.name);
      byEmployee.set(a.employeeId, entry);
    }
    return [...byEmployee.values()];
  }

  /**
   * A login for an existing employee: linked to all their active assignments
   * in the org, with portal access on. Their role at each location is the
   * one the Employee module assigned — this grants no permission by itself.
   */
  private async createStaffLogin(
    manager: UserManager,
    body: CreateUserDto & { status?: AccountStatus },
  ): Promise<User> {
    const orgId = manager.organizationId;
    if (!orgId) throw new BadRequestException('Organization ID is required');
    if (!body.employeeId) {
      throw new BadRequestException('employeeId is required for staff users');
    }
    const google = body.loginMethod === 'google';
    let created = false;

    const login = await this.userRepository.manager.transaction(async (em) => {
      const assignments = await em
        .getRepository(EmployeeOrgLocationAssignment)
        .find({
          where: {
            employeeId: body.employeeId,
            organizationId: orgId,
            isActive: true,
          },
          lock: { mode: 'pessimistic_write' },
        });
      if (!assignments.length) {
        throw new NotFoundException('Employee not found in this organization');
      }
      if (assignments.some((a) => a.userId)) {
        throw new ConflictException('This employee already has a login');
      }
      // An existing account (works at another clinic) is reused as is.
      let user = await em
        .getRepository(User)
        .createQueryBuilder('u')
        .where('LOWER(u.email) = LOWER(:email)', { email: body.email })
        .getOne();
      if (user) {
        if (user.globalRole === GlobalRole.SUPER_ADMIN) {
          throw new ConflictException(
            'This email belongs to a platform administrator',
          );
        }
        const taken = await em
          .getRepository(EmployeeOrgLocationAssignment)
          .exists({ where: { userId: user.uuid, organizationId: orgId } });
        if (taken) {
          throw new ConflictException(
            'This login already belongs to someone in this clinic',
          );
        }
      } else {
        if (!google && !body.password) {
          throw new BadRequestException('Password is required');
        }
        user = await em.getRepository(User).save(
          em.getRepository(User).create({
            email: google ? body.email.toLowerCase() : body.email,
            name: body.name,
            phone: body.phone,
            password: google
              ? undefined
              : await bcrypt.hash(body.password!, 12),
            provider: google ? ProviderEnum.GOOGLE : ProviderEnum.LOCAL,
            globalRole: null,
            status: body.status || AccountStatus.ACTIVE,
          }),
        );
        created = true;
      }
      const login = user;
      for (const a of assignments) {
        a.userId = login.uuid;
        a.hasPortalAccess = true;
      }
      // Saved through the repository so the access-version subscriber bumps.
      await em.getRepository(EmployeeOrgLocationAssignment).save(assignments);
      return login;
    });
    // After commit: a new password login works only once its email is verified.
    if (created && login.password) {
      await this.verification.start(login, new Date());
    }
    void this.notifications.notify({
      organizationId: orgId,
      eventCode: 'employee.login_created',
      recipients: [staffRecipient(login.uuid)],
      variables: { login_email: login.email },
      link: '/',
      entity: { type: 'user', id: login.uuid },
    });
    return login;
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

    const previousEmail = targetUser.email;
    const emailChanged =
      !!body.email &&
      body.email.trim().toLowerCase() !== targetUser.email.trim().toLowerCase();
    if (body.email) targetUser.email = body.email;
    if (body.name) targetUser.name = body.name;
    if (body.phone) targetUser.phone = body.phone;
    if (body.status) targetUser.status = body.status as AccountStatus;

    if (body.password) {
      targetUser.password = await bcrypt.hash(body.password, 12);
    }

    const saved = await this.userRepository.save(targetUser);
    // A new address must be proven again before it is used.
    if (emailChanged) {
      await this.verification.emailChanged(saved, previousEmail);
    }
    return saved;
  }

  /** Send a fresh verification link to a user this manager may modify. */
  async resendVerification(
    manager: UserManager,
    targetUserId: string,
  ): Promise<{ sent: boolean; result: string }> {
    const target = await this.userRepository.findOne({
      where: { uuid: targetUserId },
    });
    if (!target) throw new NotFoundException('User not found');
    if (!manager.isSuperAdmin) {
      await this.assertManageable(manager, target, 'modify');
    }
    const result = await this.verification.resend(target.uuid);
    return { sent: result === 'sent', result };
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
    // An account that also belongs to another clinic is that person's own:
    // one clinic must not change its password / email / status or delete it
    // (that would take over their access everywhere). Clinics remove such a
    // person from their own clinic under Employees instead.
    if (await this.belongsElsewhere(target.uuid, orgId!)) {
      throw new ForbiddenException(
        `This person also belongs to another clinic, so only they (or platform support) can ${verb} their account. You can remove them from your clinic under Employees.`,
      );
    }
  }

  /** Owner of, or staff at, any organization other than `orgId`. */
  async belongsElsewhere(userUuid: string, orgId: string): Promise<boolean> {
    const em = this.userRepository.manager;
    const [owner, staff] = await Promise.all([
      em
        .getRepository(OrganizationOwnership)
        .createQueryBuilder('o')
        .where('o.userId = :userUuid AND o.organizationId <> :orgId', {
          userUuid,
          orgId,
        })
        .getExists(),
      em
        .getRepository(EmployeeOrgLocationAssignment)
        .createQueryBuilder('a')
        .where('a.userId = :userUuid AND a.organizationId <> :orgId', {
          userUuid,
          orgId,
        })
        .getExists(),
    ]);
    return owner || staff;
  }
}
