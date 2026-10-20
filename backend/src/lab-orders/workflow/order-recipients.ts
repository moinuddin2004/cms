import type { EntityManager } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { PatientDataLevel } from 'src/labs/enums/lab.enums';
import type { ResolvedRecipients } from 'src/notifications/effects/notification-recipients.registry';
import {
  NotificationAudience,
  RecipientType,
} from 'src/notifications/notifications.enums';

/**
 * Who hears about an order (lab ERD §7): the lab's active members (in-app,
 * audience `lab`) and the ordering doctor's user (audience `doctor`). The
 * patient is referred to the lab as the link's `patient_data_level` allows.
 * Used for `order.submitted` and by `notify` effects on order transitions.
 */
export async function orderRecipients(
  m: EntityManager,
  orderId: string,
): Promise<ResolvedRecipients> {
  const [o] = await sqlRows<{
    id: string;
    order_no: string | null;
    location_id: string;
    lab_id: string;
    doctor_id: string | null;
    organization_id: string;
    lab_expected_on: string | null;
    clinic_name: string;
    patient_name: string;
    patient_number: string;
    data_level: PatientDataLevel;
  }>(
    m,
    `SELECT o.id, o.order_no, o.location_id, o.lab_id, o.doctor_id, o.organization_id,
            to_char(o.lab_expected_on, 'YYYY-MM-DD') AS lab_expected_on,
            org.name AS clinic_name, p.full_name AS patient_name,
            p.patient_number, l.patient_data_level AS data_level
       FROM lab_orders o
       JOIN organizations org ON org.id = o.organization_id
       JOIN patients p ON p.id = o.patient_id
       JOIN lab_clinic_links l ON l.id = o.lab_clinic_link_id
      WHERE o.id = $1`,
    [orderId],
  );
  const members = await sqlRows<{ user_id: string }>(
    m,
    `SELECT user_id FROM lab_members WHERE lab_id = $1 AND is_active`,
    [o.lab_id],
  );
  const doctor = o.doctor_id
    ? await sqlRows<{ user_id: string }>(
        m,
        `SELECT user_id FROM employee_org_location_assignments
          WHERE employee_id = $1 AND organization_id = $2 AND user_id IS NOT NULL
          ORDER BY is_active DESC LIMIT 1`,
        [o.doctor_id, o.organization_id],
      )
    : [];
  return {
    recipients: [
      ...members.map((r) => ({
        audience: NotificationAudience.LAB,
        type: RecipientType.USER,
        id: r.user_id,
      })),
      ...doctor.map((r) => ({
        audience: NotificationAudience.DOCTOR,
        type: RecipientType.USER,
        id: r.user_id,
      })),
    ],
    variables: {
      order_no: o.order_no,
      clinic_name: o.clinic_name,
      patient_ref:
        o.data_level === PatientDataLevel.CODE_ONLY
          ? o.patient_number
          : o.patient_name,
      due_on: o.lab_expected_on,
    },
    link: `/lab-portal/orders/${o.id}`,
    locationId: o.location_id,
  };
}
