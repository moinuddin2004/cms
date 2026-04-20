import { Patient } from '../../entities/patient.entity';

/**
 * Patient response DTO — controls the shape of patient data sent to clients.
 */
export class PatientResponseDto {
  id: string;
  patientNumber: string;
  organizationId: string;
  fullName: string;
  phone: string;
  dob: string | null;
  gender: string | null;
  bloodGroup: string | null;
  maritalStatus: string | null;
  occupation: string | null;
  cnic: string | null;
  whatsappNumber: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  preferredLanguage: string;
  communicationPref: string;
  primaryLocationId: string | null;
  source: string;
  referredByText: string | null;
  profilePictureUrl: string | null;
  isMinor: boolean;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianRelation: string | null;
  medicalHistory: string | null;
  allergies: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  internalNotes: string | null;
  tags: string[];
  isActive: boolean;
  isBlacklisted: boolean;
  blacklistReason: string | null;
  userId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;

  static toDto(patient: Patient): PatientResponseDto {
    const dto = new PatientResponseDto();
    dto.id = patient.id;
    dto.patientNumber = patient.patientNumber;
    dto.organizationId = patient.organizationId;
    dto.fullName = patient.fullName;
    dto.phone = patient.phone;
    dto.dob = patient.dob
      ? patient.dob instanceof Date
        ? patient.dob.toISOString().split('T')[0]
        : String(patient.dob).split('T')[0]
      : null;
    dto.gender = patient.gender;
    dto.bloodGroup = patient.bloodGroup;
    dto.maritalStatus = patient.maritalStatus;
    dto.occupation = patient.occupation;
    dto.cnic = patient.cnic;
    dto.whatsappNumber = patient.whatsappNumber;
    dto.email = patient.email;
    dto.address = patient.address;
    dto.city = patient.city;
    dto.preferredLanguage = patient.preferredLanguage;
    dto.communicationPref = patient.communicationPref;
    dto.primaryLocationId = patient.primaryLocationId;
    dto.source = patient.source;
    dto.referredByText = patient.referredByText;
    dto.profilePictureUrl = patient.profilePictureUrl;
    dto.isMinor = patient.isMinor;
    dto.guardianName = patient.guardianName;
    dto.guardianPhone = patient.guardianPhone;
    dto.guardianRelation = patient.guardianRelation;
    dto.medicalHistory = patient.medicalHistory;
    dto.allergies = patient.allergies;
    dto.emergencyContactName = patient.emergencyContactName;
    dto.emergencyContactPhone = patient.emergencyContactPhone;
    dto.emergencyContactRelation = patient.emergencyContactRelation;
    dto.internalNotes = patient.internalNotes;
    dto.tags = patient.tags || [];
    dto.isActive = patient.isActive;
    dto.isBlacklisted = patient.isBlacklisted;
    dto.blacklistReason = patient.blacklistReason;
    dto.userId = patient.userId;
    dto.createdBy = patient.createdBy;
    dto.createdAt = patient.createdAt.toISOString();
    dto.updatedAt = patient.updatedAt.toISOString();
    return dto;
  }

  static toDtoList(patients: Patient[]): PatientResponseDto[] {
    return patients.map((p) => PatientResponseDto.toDto(p));
  }
}
