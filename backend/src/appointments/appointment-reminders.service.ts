import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ClockService } from 'src/common/clock/clock.service';
import { sqlRows } from 'src/common/database/sql';
import { SkipSendError } from 'src/notifications/delivery/channel-provider';
import { PayloadFinalizers } from 'src/notifications/delivery/payload-finalizers';
import { OutboxStatus } from 'src/notifications/notifications.enums';
import { patientPushRecipients } from 'src/notifications/recipients/patient-recipients';
import { NotificationService } from 'src/notifications/services/notification.service';
import { PatientDevicesService } from 'src/patient-devices/patient-devices.service';

export const APPOINTMENT_REMINDER_EVENT = 'appointment.reminder';

/** The reminder goes out this long before the appointment starts. */
export const REMINDER_LEAD_MS = 24 * 60 * 60_000;

export interface ReminderTarget {
  id: string;
  organizationId: string;
  locationId: string;
  patientId: string;
  startTime: Date;
  endTime: Date;
}

/**
 * "Appointment tomorrow" push for patients who use the app (M3-07).
 *
 * Booking an appointment enqueues one outbox row whose `scheduled_for` is
 * 24 h before the start; the notification worker sends it then. Any change of
 * time, length or patient, a cancellation or a no-show first drops the pending
 * rows of that appointment (`skipPending`) and, when still applicable,
 * schedules a fresh one. As a second line of defence the send-time check
 * requires the appointment to still be booked for the same patient (the row's
 * recipient) and the exact start and end the row was made for, so a stale row
 * can never reach a phone. The text is the clinic's name and the time only.
 */
@Injectable()
export class AppointmentReminderService {
  private readonly logger = new Logger(AppointmentReminderService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifications: NotificationService,
    private readonly patientDevices: PatientDevicesService,
    private readonly clock: ClockService,
    finalizers: PayloadFinalizers,
  ) {
    finalizers.register(APPOINTMENT_REMINDER_EVENT, async (n) => {
      // The row is only valid for the exact booking it was made for: same
      // patient (the recipient), same start and end, still scheduled/confirmed.
      // Pending rows are also skipped when any of that changes, so this is the
      // second line of defence (a row already claimed by the worker).
      const [row] = await sqlRows<{
        status: string;
        start_time: Date;
        end_time: Date;
        patient_id: string;
      }>(
        this.dataSource.manager,
        `SELECT status, start_time, end_time, patient_id FROM appointments WHERE id = $1`,
        [n.entityId],
      );
      const v = n.payload.variables;
      const valid =
        !!row &&
        (row.status === 'scheduled' || row.status === 'confirmed') &&
        row.patient_id === n.recipientId &&
        new Date(row.start_time).toISOString() === v.start_at &&
        new Date(row.end_time).toISOString() === v.end_at;
      if (!valid) {
        throw new SkipSendError(
          OutboxStatus.SKIPPED_DISABLED,
          'The appointment was cancelled, moved or reassigned after this reminder was scheduled',
        );
      }
      return n.payload;
    });
  }

  /**
   * Drops every reminder of this appointment that has not been sent yet
   * (cancel, no-show, or before a fresh one is scheduled). Rows already sent
   * are history and stay.
   */
  async skipPending(appointmentId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE notification_outbox
          SET status = '${OutboxStatus.SKIPPED_DISABLED}', updated_at = now(),
              last_error = 'Superseded: the appointment changed or was cancelled'
        WHERE event_code = $1 AND entity_id = $2
          AND status IN ('${OutboxStatus.QUEUED}', '${OutboxStatus.HELD_QUIET_HOURS}')`,
      [APPOINTMENT_REMINDER_EVENT, appointmentId],
    );
  }

  /** Cancelled / no-show: nothing is due any more. Fire-and-forget, never throws. */
  cancel(appointmentId: string): void {
    void this.skipPending(appointmentId).catch((err: Error) =>
      this.logger.error(`Reminder cleanup failed: ${err.message}`),
    );
  }

  /**
   * (Re)schedule after commit, fire-and-forget: never fails the booking. Any
   * pending reminder of the appointment is dropped first, so a change of time,
   * length or patient never leaves a stale or duplicate row. Nothing new is
   * queued when the appointment is less than a day away (or the patient is
   * not an app user).
   */
  schedule(a: ReminderTarget): void {
    const dueAt = new Date(a.startTime.getTime() - REMINDER_LEAD_MS);
    void this.notifications.notify(async () => {
      await this.skipPending(a.id);
      if (dueAt <= this.clock.now()) return null;
      const recipients = await patientPushRecipients(
        this.patientDevices,
        this.dataSource.manager,
        a.organizationId,
        [a.patientId],
        // The phone may be registered between booking and the reminder; the
        // provider looks the devices up again when it sends.
        false,
      );
      if (!recipients.length) return null;
      return {
        organizationId: a.organizationId,
        locationId: a.locationId,
        eventCode: APPOINTMENT_REMINDER_EVENT,
        recipients,
        variables: {
          appointment_time: await this.notifications.clinicTime(
            a.startTime,
            a.locationId,
          ),
          start_at: a.startTime.toISOString(),
          end_at: a.endTime.toISOString(),
        },
        link: `/appointments/${a.id}`,
        entity: { type: 'appointment', id: a.id },
        scheduledFor: dueAt,
      };
    });
  }
}
