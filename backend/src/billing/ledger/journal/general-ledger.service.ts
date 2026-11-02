import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  JournalSource,
  LedgerJournal,
  LedgerJournalLine,
} from './ledger-journal.entity';

export interface JournalLineInput {
  accountCode: string;
  debitMinor?: number;
  creditMinor?: number;
  patientId?: string | null;
  labId?: string | null;
  doctorId?: string | null;
  labOrderId?: string | null;
}

export interface JournalInput {
  organizationId: string;
  locationId?: string | null;
  entryOn: string;
  sourceType: JournalSource;
  sourceId: string;
  memo: string;
  createdBy: string | null;
  lines: JournalLineInput[];
}

/** Thrown before anything is written; a bug in the caller's posting rule. */
export class UnbalancedJournalError extends Error {}

/**
 * Lab ERD inv. 6: every journal balances (Σ debit = Σ credit) and lines are
 * never updated or deleted. Checked here, in the caller's transaction, since
 * the schema comes from entities (no trigger). Zero lines are dropped.
 */
export function checkJournal(lines: JournalLineInput[]): number {
  let debit = 0;
  let credit = 0;
  for (const l of lines) {
    const d = l.debitMinor ?? 0;
    const c = l.creditMinor ?? 0;
    if (!Number.isSafeInteger(d) || !Number.isSafeInteger(c) || d < 0 || c < 0)
      throw new UnbalancedJournalError(`Bad amount on ${l.accountCode}`);
    if (d > 0 && c > 0)
      throw new UnbalancedJournalError(`${l.accountCode} has both sides`);
    debit += d;
    credit += c;
  }
  if (debit !== credit)
    throw new UnbalancedJournalError(
      `Journal does not balance: debit ${debit} ≠ credit ${credit}`,
    );
  if (debit === 0) throw new UnbalancedJournalError('Empty journal');
  return debit;
}

/** Double-entry general ledger next to billing v2's patient ledger. */
@Injectable()
export class GeneralLedgerService {
  async post(m: EntityManager, input: JournalInput): Promise<LedgerJournal> {
    const lines = input.lines.filter(
      (l) => (l.debitMinor ?? 0) > 0 || (l.creditMinor ?? 0) > 0,
    );
    const total = checkJournal(lines);
    return this.insert(m, input, lines, total, null);
  }

  /** Mirror journal: every line's sides swapped. One reversal per journal. */
  async reverse(
    m: EntityManager,
    journalId: string,
    opts: { entryOn: string; memo: string; createdBy: string | null },
  ): Promise<LedgerJournal> {
    const original = await m.getRepository(LedgerJournal).findOneOrFail({
      where: { id: journalId },
      relations: { lines: true },
    });
    const lines: JournalLineInput[] = original.lines.map((l) => ({
      accountCode: l.accountCode,
      debitMinor: l.creditMinor,
      creditMinor: l.debitMinor,
      patientId: l.patientId,
      labId: l.labId,
      doctorId: l.doctorId,
      labOrderId: l.labOrderId,
    }));
    const total = checkJournal(lines);
    return this.insert(
      m,
      {
        organizationId: original.organizationId,
        locationId: original.locationId,
        entryOn: opts.entryOn,
        sourceType: original.sourceType,
        sourceId: original.sourceId,
        memo: opts.memo,
        createdBy: opts.createdBy,
        lines,
      },
      lines,
      total,
      original.id,
    );
  }

  /** Journals (with lines) of one source, oldest first. */
  forSource(
    m: EntityManager,
    organizationId: string,
    sourceType: JournalSource,
    sourceId: string,
  ): Promise<LedgerJournal[]> {
    return m.getRepository(LedgerJournal).find({
      where: { organizationId, sourceType, sourceId },
      relations: { lines: true },
      order: { createdAt: 'ASC' },
    });
  }

  private async insert(
    m: EntityManager,
    input: JournalInput,
    lines: JournalLineInput[],
    total: number,
    reversalOfId: string | null,
  ): Promise<LedgerJournal> {
    const journal = await m.getRepository(LedgerJournal).save(
      m.getRepository(LedgerJournal).create({
        organizationId: input.organizationId,
        locationId: input.locationId ?? null,
        entryOn: input.entryOn,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        reversalOfId,
        memo: input.memo.slice(0, 200),
        totalMinor: total,
        createdBy: input.createdBy,
      }),
    );
    await m.getRepository(LedgerJournalLine).insert(
      lines.map((l) => ({
        journalId: journal.id,
        organizationId: input.organizationId,
        locationId: input.locationId ?? null,
        accountCode: l.accountCode,
        debitMinor: l.debitMinor ?? 0,
        creditMinor: l.creditMinor ?? 0,
        patientId: l.patientId ?? null,
        labId: l.labId ?? null,
        doctorId: l.doctorId ?? null,
        labOrderId: l.labOrderId ?? null,
      })),
    );
    return journal;
  }
}
