import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneralLedgerService } from './general-ledger.service';
import { LedgerJournal, LedgerJournalLine } from './ledger-journal.entity';

/**
 * Billing's double-entry journals (lab ERD §6c). Small on purpose so lab
 * payables (and later lab patient billing) can post without pulling in the
 * whole billing module.
 */
@Module({
  imports: [TypeOrmModule.forFeature([LedgerJournal, LedgerJournalLine])],
  providers: [GeneralLedgerService],
  exports: [GeneralLedgerService],
})
export class GeneralLedgerModule {}
