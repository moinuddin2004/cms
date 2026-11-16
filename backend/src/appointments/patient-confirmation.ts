/**
 * A patient's confirmation (M3-08) is for the time they saw. When staff move
 * the appointment (start or length), it no longer applies and is cleared so
 * the patient can confirm the new time.
 */
export function clearConfirmationOnReschedule(
  appt: { patientConfirmedAt: Date | null },
  timeChanged: boolean,
): void {
  if (timeChanged) appt.patientConfirmedAt = null;
}
