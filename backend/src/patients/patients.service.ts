import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { CreatePatientDto } from './dto/request/create-patient.dto';
import { UpdatePatientDto } from './dto/request/update-patient.dto';
import {
  PatientQueryDto,
  PatientSortBy,
  SortOrder,
} from './dto/request/patient-query.dto';
import { PatientResponseDto } from './dto/response/patient-response.dto';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { AppLogger } from 'src/common/services/logger.service';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Generates the next patient ID in format PT-XXXX.
   * Queries the highest existing patientId and increments.
   */
  private async generatePatientId(): Promise<string> {
    const result = await this.patientRepository
      .createQueryBuilder('patient')
      .select('patient.patientId', 'patientId')
      .orderBy('CAST(SUBSTRING(patient.patient_id FROM 4) AS INTEGER)', 'DESC')
      .limit(1)
      .getRawOne();

    let nextNumber = 1;
    if (result?.patientId) {
      const currentNumber = parseInt(result.patientId.replace('PT-', ''), 10);
      nextNumber = currentNumber + 1;
    }

    return `PT-${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Validates that a phone number is unique.
   * Optionally excludes a specific patient (for update scenarios).
   */
  private async validatePhoneUnique(
    phone: string,
    excludeId?: string,
  ): Promise<void> {
    const whereCondition: any = { phone };
    if (excludeId) {
      whereCondition.id = Not(excludeId);
    }

    const existingPatient = await this.patientRepository.findOne({
      where: whereCondition,
    });

    if (existingPatient) {
      throw new ConflictException(
        'A patient with this phone number already exists',
      );
    }
  }

  /**
   * Creates a new patient with auto-generated ID and phone uniqueness check.
   */
  async create(dto: CreatePatientDto): Promise<PatientResponseDto> {
    this.logger.info(`Creating patient: ${dto.fullName}`, PatientsService.name);

    await this.validatePhoneUnique(dto.phone);

    const patientId = await this.generatePatientId();

    const patient = this.patientRepository.create({
      ...dto,
      patientId,
      dob: dto.dob ? new Date(dto.dob) : null,
    });

    const saved = await this.patientRepository.save(patient);
    this.logger.info(
      `Patient created: ${saved.patientId}`,
      PatientsService.name,
    );

    return PatientResponseDto.toDto(saved);
  }

  /**
   * Finds all patients with search, filters, pagination, and sorting.
   */
  async findAll(
    query: PatientQueryDto,
  ): Promise<PaginatedResponseDto<PatientResponseDto>> {
    const {
      page = 1,
      limit = 10,
      search,
      gender,
      bloodGroup,
      isActive,
      sortBy = PatientSortBy.CREATED_AT,
      sortOrder = SortOrder.DESC,
    } = query;

    const qb = this.patientRepository.createQueryBuilder('patient');

    // Search by name or phone (case-insensitive)
    if (search && search.trim()) {
      qb.andWhere(
        '(patient.full_name ILIKE :search OR patient.phone ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    // Filters
    if (gender) {
      qb.andWhere('patient.gender = :gender', { gender });
    }

    if (bloodGroup) {
      qb.andWhere('patient.blood_group = :bloodGroup', { bloodGroup });
    }

    if (isActive !== undefined && isActive !== null) {
      qb.andWhere('patient.is_active = :isActive', { isActive });
    }

    // Sorting — map DTO field names to column names
    const sortColumnMap: Record<string, string> = {
      createdAt: 'patient.created_at',
      fullName: 'patient.full_name',
      patientId: 'patient.patient_id',
    };

    const sortColumn = sortColumnMap[sortBy] || 'patient.created_at';
    qb.orderBy(sortColumn, sortOrder);

    // Pagination
    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const [patients, total] = await qb.getManyAndCount();

    const data = PatientResponseDto.toDtoList(patients);
    return PaginatedResponseDto.create(data, total, page, limit);
  }

  /**
   * Finds a single patient by UUID.
   */
  async findOne(id: string): Promise<PatientResponseDto> {
    const patient = await this.patientRepository.findOne({ where: { id } });
    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }
    return PatientResponseDto.toDto(patient);
  }

  /**
   * Updates a patient with phone uniqueness validation.
   */
  async update(id: string, dto: UpdatePatientDto): Promise<PatientResponseDto> {
    this.logger.info(`Updating patient: ${id}`, PatientsService.name);

    const patient = await this.patientRepository.findOne({ where: { id } });
    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    // If phone is being changed, validate uniqueness
    if (dto.phone && dto.phone !== patient.phone) {
      await this.validatePhoneUnique(dto.phone, id);
    }

    // Merge updates — convert dob string to Date, exclude raw dob from spread
    const { dob, ...restDto } = dto;
    const updateData: Partial<Patient> = { ...restDto };
    if (dob !== undefined) {
      updateData.dob = dob ? new Date(dob) : null;
    }

    Object.assign(patient, updateData);
    const saved = await this.patientRepository.save(patient);

    this.logger.info(
      `Patient updated: ${saved.patientId}`,
      PatientsService.name,
    );

    return PatientResponseDto.toDto(saved);
  }

  /**
   * Soft-deletes a patient by setting isActive to false.
   */
  async deactivate(id: string): Promise<PatientResponseDto> {
    this.logger.info(`Deactivating patient: ${id}`, PatientsService.name);

    const patient = await this.patientRepository.findOne({ where: { id } });
    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    patient.isActive = false;
    const saved = await this.patientRepository.save(patient);

    this.logger.info(
      `Patient deactivated: ${saved.patientId}`,
      PatientsService.name,
    );

    return PatientResponseDto.toDto(saved);
  }

  /**
   * Checks if a phone number is already in use.
   * Optionally excludes a patient ID (for edit scenarios).
   */
  async checkPhoneExists(
    phone: string,
    excludeId?: string,
  ): Promise<{ exists: boolean }> {
    const whereCondition: any = { phone };
    if (excludeId) {
      whereCondition.id = Not(excludeId);
    }

    const existing = await this.patientRepository.findOne({
      where: whereCondition,
    });

    return { exists: !!existing };
  }
}
