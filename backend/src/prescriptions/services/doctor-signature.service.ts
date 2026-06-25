import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorSignature } from '../entities/doctor-signature.entity';

export interface SaveSignatureInput {
  /** Either a Cloudinary/HTTPS URL or a `data:image/...;base64,…` payload. */
  signatureImageUrl: string;
  /** Raw canvas data, kept for re-editing in the signature pad. */
  signatureData?: string;
}

/**
 * One signature per doctor. Repeat saves upsert in place — unique index on
 * `employeeId` enforces that at the DB level.
 *
 * `signatureImageUrl` accepts either a Cloudinary/HTTPS URL (preferred for
 * embedding in printed PDFs) or a base64 `data:` URL (used as a fallback
 * when external storage isn't configured — same approach used by consent
 * signatures in the patients module).
 */
@Injectable()
export class DoctorSignatureService {
  constructor(
    @InjectRepository(DoctorSignature)
    private readonly repo: Repository<DoctorSignature>,
  ) {}

  async save(
    employeeId: string,
    organizationId: string,
    input: SaveSignatureInput,
  ): Promise<DoctorSignature> {
    const existing = await this.repo.findOne({ where: { employeeId } });
    if (existing) {
      Object.assign(existing, {
        signatureImageUrl: input.signatureImageUrl,
        signatureData: input.signatureData ?? existing.signatureData,
        isActive: true,
      });
      return this.repo.save(existing);
    }
    const row = this.repo.create({
      employeeId,
      organizationId,
      signatureImageUrl: input.signatureImageUrl,
      signatureData: input.signatureData ?? null,
    });
    return this.repo.save(row);
  }

  async getByEmployee(
    employeeId: string,
  ): Promise<DoctorSignature | null> {
    return this.repo.findOne({
      where: { employeeId, isActive: true },
    });
  }

  async deleteByEmployee(
    employeeId: string,
    organizationId: string,
  ): Promise<{ id: string }> {
    const row = await this.repo.findOne({
      where: { employeeId, organizationId },
    });
    if (!row) throw new NotFoundException('Signature not found');
    await this.repo.remove(row);
    return { id: row.id };
  }
}
