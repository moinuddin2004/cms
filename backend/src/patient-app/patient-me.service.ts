import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PatientAccount } from 'src/patient-auth/entities/patient-account.entity';
import type { PatientMeDto } from './dto/patient-me.dto';
import type { PatientContext } from './guards/patient-link.guard';

@Injectable()
export class PatientMeService {
  constructor(
    @InjectRepository(PatientAccount)
    private readonly accounts: Repository<PatientAccount>,
  ) {}

  async get(ctx: PatientContext): Promise<PatientMeDto> {
    return this.toDto(await this.load(ctx.accountId));
  }

  async updateName(
    ctx: PatientContext,
    fullName: string,
  ): Promise<PatientMeDto> {
    const account = await this.load(ctx.accountId);
    account.fullName = fullName;
    return this.toDto(await this.accounts.save(account));
  }

  private async load(accountId: string): Promise<PatientAccount> {
    const account = await this.accounts.findOne({
      where: { id: accountId, deletedAt: IsNull() },
    });
    if (!account) throw new NotFoundException();
    return account;
  }

  private toDto(a: PatientAccount): PatientMeDto {
    return {
      id: a.id,
      fullName: a.fullName,
      email: a.email,
      createdAt: a.createdAt,
    };
  }
}
