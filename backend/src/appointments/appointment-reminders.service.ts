import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
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
   * are history and stay. `entity_type` leads the filter so the
   * `(entity_type, entity_id)` index serves it (no scan of the outbox).
   */
  async skipPending(m: EntityManager, appointmentId: string): Promise<void> {
    await m.query(
      `UPDATE notification_outbox
          SET status = '${OutboxStatus.SKIPPED_DISABLED}', updated_at = now(),
              last_error = 'Superseded: the appointment changed or was cancelled'
        WHERE entity_type = 'appointment' AND entity_id = $2 AND event_code = $1
          AND status IN ('${OutboxStatus.QUEUED}', '${OutboxStatus.HELD_QUIET_HOURS}')`,
      [APPOINTMENT_REMINDER_EVENT, appointmentId],
    );
  }

  /**
   * One transaction per appointment under an advisory lock: two quick saves
   * serialise, so the second one sees (and skips) what the first inserted and
   * never leaves two pending reminders.
   */
  private async locked(
    appointmentId: string,
    work: (m: EntityManager) => Promise<void>,
  ): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      await m.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `appointment-reminder:${appointmentId}`,
      ]);
      await work(m);
    });
  }

  /** Cancelled / no-show: nothing is due any more. Fire-and-forget, never throws. */
  cancel(appointmentId: string): void {
    void this.locked(appointmentId, (m) =>
      this.skipPending(m, appointmentId),
    ).catch((err: Error) =>
      this.logger.error(`Reminder cleanup failed: ${err.message}`),
    );
  }

  /**
   * (Re)schedule after commit, fire-and-forget: never fails the booking. Under
   * the appointment's lock: drop the pending reminders, re-read the booking
   * (so a slower, older call can never schedule stale data) and queue a fresh
   * one when it is still booked and more than a day away for an app user.
   */
  schedule(a: ReminderTarget): void {
    void this.locked(a.id, async (m) => {
      await this.skipPending(m, a.id);
      const [cur] = await sqlRows<{
        organization_id: string;
        location_id: string;
        patient_id: string;
        start_time: Date;
        end_time: Date;
        status: string;
      }>(
        m,
        `SELECT organization_id, location_id, patient_id, start_time, end_time, status
           FROM appointments WHERE id = $1`,
        [a.id],
      );
      if (!cur || (cur.status !== 'scheduled' && cur.status !== 'confirmed')) {
        return;
      }
      const startTime = new Date(cur.start_time);
      const endTime = new Date(cur.end_time);
      const dueAt = new Date(startTime.getTime() - REMINDER_LEAD_MS);
      if (dueAt <= this.clock.now()) return;
      const recipients = await patientPushRecipients(
        this.patientDevices,
        m,
        cur.organization_id,
        [cur.patient_id],
        // The phone may be registered between booking and the reminder; the
        // provider looks the devices up again when it sends.
        false,
      );
      if (!recipients.length) return;
      await this.notifications.enqueueSafely(m, {
        organizationId: cur.organization_id,
        locationId: cur.location_id,
        eventCode: APPOINTMENT_REMINDER_EVENT,
        recipients,
        variables: {
          appointment_time: await this.notifications.clinicTime(
            startTime,
            cur.location_id,
          ),
          start_at: startTime.toISOString(),
          end_at: endTime.toISOString(),
        },
        link: `/appointments/${a.id}`,
        entity: { type: 'appointment', id: a.id },
        scheduledFor: dueAt,
      });
    }).catch((err: Error) =>
      this.logger.error(`Reminder not scheduled: ${err.message}`),
    );
  }
}
