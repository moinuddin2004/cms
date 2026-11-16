import type { EntityManager } from 'typeorm';
import type { PatientDevicesService } from 'src/patient-devices/patient-devices.service';
import { NotificationAudience, RecipientType } from '../notifications.enums';
import type { NotificationRecipient } from '../services/notification.service';

/**
 * Who hears about a clinic patient in the patient app (M3-07): the patient
 * (clinic `patients.id`) → their ACTIVE `patient_record_links` row → the app
 * account behind its profile → that account's devices. Only patients with at
 * least one reachable phone are returned, so a clinic's non-app patients
 * never create outbox rows. The phones themselves are looked up again at
 * send time (`ExpoPushProvider`), so a token added or removed in between is
 * respected.
 */
export async function patientPushRecipients(
  devices: PatientDevicesService,
  m: EntityManager,
  organizationId: string,
  patientIds: string[],
  requireDevice = true,
): Promise<NotificationRecipient[]> {
  const reachable = await devices.patientsWithDevices(
    m,
    organizationId,
    patientIds,
    requireDevice,
  );
  return reachable.map((id) => ({
    audience: NotificationAudience.PATIENT,
    type: RecipientType.PATIENT,
    id,
  }));
}
