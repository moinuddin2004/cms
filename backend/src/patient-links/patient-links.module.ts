import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientClaimToken } from './entities/patient-claim-token.entity';

/** Claim-token table (M2-01). Entity only; the claim flow arrives with M2-04. */
@Module({
  imports: [TypeOrmModule.forFeature([PatientClaimToken])],
  exports: [TypeOrmModule],
})
export class PatientLinksModule {}
