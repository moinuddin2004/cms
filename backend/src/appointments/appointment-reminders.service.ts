import { Injectable } from '@nestjs/common';
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
}

/**
 * "Appointment tomorrow" push for patients who use the app (M3-07).
 *
 * Booking (or moving) an appointment enqueues one outbox row whose
 * `scheduled_for` is 24 h before the start; the notification worker sends it
 * then. Nothing cancels that row when the appointment is cancelled or moved —
 * instead the send-time check below drops every reminder whose appointment is
 * no longer booked for exactly the time the row was made for, so a stale
 * reminder can never reach a phone. The text is the clinic's name and the
 * time only.
 */
@Injectable()
export class AppointmentReminderService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifications: NotificationService,
    private readonly patientDevices: PatientDevicesService,
    private readonly clock: ClockService,
    finalizers: PayloadFinalizers,
  ) {
    finalizers.register(APPOINTMENT_REMINDER_EVENT, async (n) => {
      const [row] = await sqlRows<{ status: string; start_time: Date }>(
        this.dataSource.manager,
        `SELECT status, start_time FROM appointments WHERE id = $1`,
        [n.entityId],
      );
      const stillBooked =
        !!row &&
        (row.status === 'scheduled' || row.status === 'confirmed') &&
        new Date(row.start_time).toISOString() === n.payload.variables.start_at;
      if (!stillBooked) {
        throw new SkipSendError(
          OutboxStatus.SKIPPED_DISABLED,
          'The appointment was cancelled or moved after this reminder was scheduled',
        );
      }
      return n.payload;
    });
  }

  /**
   * After commit, fire-and-forget: never fails the booking. Nothing is queued
   * when the appointment is less than a day away (or the patient is not an
   * app user).
   */
  schedule(a: ReminderTarget): void {
    const dueAt = new Date(a.startTime.getTime() - REMINDER_LEAD_MS);
    if (dueAt <= this.clock.now()) return;
    void this.notifications.notify(async () => {
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
        },
        link: `/appointments/${a.id}`,
        entity: { type: 'appointment', id: a.id },
        scheduledFor: dueAt,
      };
    });
  }
}
