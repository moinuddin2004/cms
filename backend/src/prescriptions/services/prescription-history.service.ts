import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrescriptionHistory } from '../entities/prescription-history.entity';
import { Prescription } from '../entities/prescription.entity';
import { PrescriptionHistoryChangeType } from '../enums/prescription-history-change-type.enum';

@Injectable()
export class PrescriptionHistoryService {
  constructor(
    @InjectRepository(PrescriptionHistory)
    private readonly repo: Repository<PrescriptionHistory>,
  ) {}

  /**
   * Append an audit row. `previousData` should be a full JSON snapshot of the
   * prescription (plus its medicines) BEFORE the change so an old version can
   * be reconstructed without joining anything else.
   */
  async log(input: {
    prescriptionId: string;
    version: number;
    changedBy: string | null;
    changeType: PrescriptionHistoryChangeType;
    previousData?: Record<string, any> | null;
    changeNotes?: string | null;
  }): Promise<PrescriptionHistory> {
    const row = this.repo.create({
      prescriptionId: input.prescriptionId,
      version: input.version,
      changedBy: input.changedBy ?? null,
      changeType: input.changeType,
      previousData: input.previousData ?? null,
      changeNotes: input.changeNotes ?? null,
    });
    return this.repo.save(row);
  }

  async listFor(prescriptionId: string): Promise<PrescriptionHistory[]> {
    return this.repo.find({
      where: { prescriptionId },
      relations: ['changedByEmployee'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Serialize a prescription + medicines to a plain JSON snapshot suitable
   * for the `previousData` column.
   */
  snapshot(p: Prescription): Record<string, any> {
    return {
      id: p.id,
      version: p.version,
      status: p.status,
      diagnosis: p.diagnosis,
      chiefComplaint: p.chiefComplaint,
      furtherPlan: p.furtherPlan,
      instructionsEnglish: p.instructionsEnglish,
      instructionsUrdu: p.instructionsUrdu,
      vitals: p.vitals,
      signatureImageUrl: p.signatureImageUrl,
      signedAt: p.signedAt,
      pdfUrl: p.pdfUrl,
      prescriptionTemplateId: p.prescriptionTemplateId,
      treatmentPlanTemplateId: p.treatmentPlanTemplateId,
      medicines: (p.medicines ?? []).map((m) => ({
        id: m.id,
        medicineDirectoryId: m.medicineDirectoryId,
        medicineName: m.medicineName,
        medicineNameUrdu: m.medicineNameUrdu,
        type: m.type,
        dosage: m.dosage,
        frequency: m.frequency,
        frequencyTiming: m.frequencyTiming,
        mealRelation: m.mealRelation,
        duration: m.duration,
        specialInstructions: m.specialInstructions,
        specialInstructionsUrdu: m.specialInstructionsUrdu,
        sortOrder: m.sortOrder,
      })),
      capturedAt: new Date().toISOString(),
    };
  }
}
