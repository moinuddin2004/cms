import { Patient } from '../../entities/patient.entity';

/**
 * Patient response DTO — controls the shape of patient data sent to clients.
 * Decouples the entity from the API contract.
 */
export class PatientResponseDto {
  id: string;
  patientId: string;
  fullName: string;
  phone: string;
  dob: string | null;
  gender: string | null;
  bloodGroup: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  medicalHistory: string | null;
  allergies: string[];
  emergencyName: string | null;
  emergencyPhone: string | null;
  emergencyRelation: string | null;
  referredBy: string | null;
  occupation: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  static toDto(patient: Patient): PatientResponseDto {
    const dto = new PatientResponseDto();
    dto.id = patient.id;
    dto.patientId = patient.patientId;
    dto.fullName = patient.fullName;
    dto.phone = patient.phone;
    dto.dob = patient.dob ? (patient.dob instanceof Date ? patient.dob.toISOString().split('T')[0] : String(patient.dob).split('T')[0]) : null;
    dto.gender = patient.gender;
    dto.bloodGroup = patient.bloodGroup;
    dto.email = patient.email;
    dto.address = patient.address;
    dto.city = patient.city;
    dto.medicalHistory = patient.medicalHistory;
    dto.allergies = patient.allergies || [];
    dto.emergencyName = patient.emergencyName;
    dto.emergencyPhone = patient.emergencyPhone;
    dto.emergencyRelation = patient.emergencyRelation;
    dto.referredBy = patient.referredBy;
    dto.occupation = patient.occupation;
    dto.isActive = patient.isActive;
    dto.createdAt = patient.createdAt.toISOString();
    dto.updatedAt = patient.updatedAt.toISOString();
    return dto;
  }

  static toDtoList(patients: Patient[]): PatientResponseDto[] {
    return patients.map((patient) => PatientResponseDto.toDto(patient));
  }
}
