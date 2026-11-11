import {
  CHANNELS_BY_AUDIENCE,
  NotificationAudience as A,
  NotificationChannel,
  NotificationLanguage,
} from '../notifications.enums';

export interface EventSeed {
  code: string;
  name: string;
  description: string;
  audiences: A[];
  isMandatoryInternal: boolean;
  /** Email on by default (important events). Default false = in-app only until switched on. */
  emailDefault?: boolean;
  /**
   * Push on by default (M1-04). Every other event stays push-off until its
   * seed lists `push` in `channels`; the seed service writes that list to
   * `notification_events.channels`, which is what the enqueue path reads.
   */
  pushDefault?: boolean;
  /** Channels this event may use at all; omitted = every channel of its audiences (push excepted, which is opt-in). */
  channels?: NotificationChannel[];
  variables: string[];
  /** Platform default wording (English). Title doubles as email subject. */
  title: string;
  body: string;
  /** Push title/body when they must differ from the bell wording (docs/03 §5). */
  pushTitle?: string;
  pushBody?: string;
}

/**
 * The platform catalog (lab ERD §7, §16). Insert-if-missing on boot: add
 * new events here; never rename a code (outbox rows reference it).
 * Mandatory: a new order reaching the lab, and anything that moves the
 * doctor's dates (§16 "Internal notifications").
 */
export const NOTIFICATION_EVENT_SEEDS: EventSeed[] = [
  {
    code: 'order.submitted',
    name: 'New lab order',
    description: 'A clinic sent a new order to the lab.',
    audiences: [A.LAB],
    isMandatoryInternal: true,
    emailDefault: true,
    variables: ['order_no', 'patient_ref', 'due_on'],
    title: 'New order {order_no}',
    body: '{clinic_name} sent order {order_no} ({patient_ref}), due {due_on}.',
  },
  {
    code: 'order.accepted',
    name: 'Order accepted by lab',
    description: 'The lab accepted an order and set its expected date.',
    audiences: [A.DOCTOR, A.COORDINATOR],
    isMandatoryInternal: false,
    variables: ['order_no', 'lab_name', 'expected_on'],
    title: 'Order {order_no} accepted',
    body: '{lab_name} accepted order {order_no}; expected on {expected_on}.',
  },
  {
    code: 'order.rejected',
    name: 'Order rejected by lab',
    description: 'The lab rejected an order.',
    audiences: [A.DOCTOR, A.COORDINATOR],
    isMandatoryInternal: true,
    emailDefault: true,
    variables: ['order_no', 'lab_name', 'reason'],
    title: 'Order {order_no} rejected',
    body: '{lab_name} rejected order {order_no}: {reason}',
  },
  {
    code: 'order.clarification_requested',
    name: 'Lab asked a question',
    description: 'The lab needs clarification before it can accept an order.',
    audiences: [A.DOCTOR, A.COORDINATOR],
    isMandatoryInternal: true,
    emailDefault: true,
    variables: ['order_no', 'lab_name', 'question'],
    title: 'Order {order_no}: the lab has a question',
    body: '{lab_name} asked about order {order_no}: {question}',
  },
  {
    code: 'order.magic_link',
    name: 'Order link for the lab (no login)',
    description:
      'A one-order link the lab opens without logging in, to view and accept, reject or query the order.',
    audiences: [A.LAB],
    isMandatoryInternal: false,
    emailDefault: true,
    variables: [
      'order_no',
      'patient_ref',
      'due_on',
      'magic_link_url',
      'expires_at',
    ],
    title: 'Order {order_no} from {clinic_name}',
    body: '{clinic_name} sent order {order_no} ({patient_ref}), due {due_on}. Open: {magic_link_url} (valid until {expires_at})',
  },
  {
    code: 'order.expected_date_changed',
    name: 'Lab changed the expected date',
    description: "The lab moved an order's expected date.",
    audiences: [A.DOCTOR, A.COORDINATOR],
    isMandatoryInternal: true,
    emailDefault: true,
    variables: ['order_no', 'lab_name', 'expected_on', 'previous_expected_on'],
    title: 'Order {order_no}: new date {expected_on}',
    body: '{lab_name} moved order {order_no} from {previous_expected_on} to {expected_on}.',
  },
  {
    code: 'order.overdue',
    name: 'Order overdue',
    description: 'An order passed its expected date and is not ready.',
    audiences: [A.DOCTOR, A.COORDINATOR],
    isMandatoryInternal: false,
    variables: ['order_no', 'lab_name', 'expected_on'],
    title: 'Order {order_no} is overdue',
    body: 'Order {order_no} at {lab_name} was expected on {expected_on}.',
  },
  {
    code: 'item.ready',
    name: 'Work ready',
    description: 'Lab work is ready; the patient can book an appointment.',
    audiences: [A.DOCTOR, A.COORDINATOR, A.PATIENT],
    isMandatoryInternal: false,
    variables: ['order_no', 'item_name', 'patient_name'],
    title: '{item_name} ready ({order_no})',
    body: 'Dear {recipient_name}, your {item_name} is ready at {clinic_name}. Please book an appointment.',
  },
  {
    code: 'shipment.dispatched',
    name: 'Shipment dispatched',
    description: 'The lab dispatched a shipment to the clinic.',
    audiences: [A.COORDINATOR],
    isMandatoryInternal: false,
    variables: ['shipment_no', 'lab_name'],
    title: 'Shipment {shipment_no} dispatched',
    body: '{lab_name} dispatched shipment {shipment_no}.',
  },
  {
    code: 'shipment.received',
    name: 'Shipment received',
    description: 'The clinic received a shipment from the lab.',
    audiences: [A.LAB],
    isMandatoryInternal: false,
    variables: ['shipment_no'],
    title: 'Shipment {shipment_no} received',
    body: '{clinic_name} received shipment {shipment_no}.',
  },
  {
    code: 'remake.requested',
    name: 'Remake requested',
    description: 'The clinic asked the lab to remake an item.',
    audiences: [A.LAB],
    isMandatoryInternal: true,
    emailDefault: true,
    variables: ['order_no', 'item_name', 'reason'],
    title: 'Remake requested ({order_no})',
    body: '{clinic_name} requested a remake of {item_name} on order {order_no}: {reason}',
  },
  // ── Sprint 8 production (lab ERD §14 steps 6–8) ─────────────────────
  {
    code: 'remake.agreed',
    name: 'Remake agreed',
    description: 'The clinic agreed a remake; a new item was added.',
    audiences: [A.LAB],
    isMandatoryInternal: true,
    emailDefault: true,
    variables: ['order_no', 'item_name', 'responsible_party'],
    title: 'Remake agreed ({order_no})',
    body: '{clinic_name} agreed a remake of {item_name} on order {order_no} (responsible: {responsible_party}).',
  },
  {
    code: 'stage.sent_to_clinic',
    name: 'Try-in work on its way',
    description: 'The lab dispatched try-in or final work to the clinic.',
    audiences: [A.DOCTOR, A.COORDINATOR],
    isMandatoryInternal: false,
    variables: ['order_no', 'item_name', 'stage_name', 'shipment_no'],
    title: '{stage_name} dispatched ({order_no})',
    body: '{item_name} ({stage_name}) for order {order_no} is on its way in shipment {shipment_no}.',
  },
  {
    code: 'stage.approved',
    name: 'Stage approved',
    description: 'The doctor approved a try-in stage or the final work.',
    audiences: [A.LAB],
    isMandatoryInternal: false,
    variables: ['order_no', 'item_name', 'stage_name'],
    title: '{stage_name} approved ({order_no})',
    body: '{clinic_name} approved {stage_name} of {item_name} on order {order_no}.',
  },
  {
    code: 'stage.correction',
    name: 'Correction requested',
    description: 'The doctor asked for a correction after a try-in.',
    audiences: [A.LAB],
    isMandatoryInternal: true,
    emailDefault: true,
    variables: ['order_no', 'item_name', 'stage_name', 'round_no', 'notes'],
    title: 'Correction: {stage_name} ({order_no})',
    body: '{clinic_name} needs a correction of {stage_name} of {item_name} on order {order_no} (round {round_no}): {notes}',
  },
  {
    code: 'shipment.lost',
    name: 'Shipment lost',
    description: 'A shipment between the clinic and the lab was marked lost.',
    audiences: [A.LAB, A.DOCTOR],
    isMandatoryInternal: true,
    emailDefault: true,
    variables: ['shipment_no', 'reason'],
    title: 'Shipment {shipment_no} lost',
    body: 'Shipment {shipment_no} was marked lost: {reason}',
  },
  {
    code: 'order.completed',
    name: 'Case complete',
    description: 'All work on an order is delivered.',
    audiences: [A.DOCTOR, A.PATIENT],
    isMandatoryInternal: false,
    variables: ['order_no', 'patient_name'],
    title: 'Order {order_no} complete',
    body: 'Dear {recipient_name}, your treatment work at {clinic_name} is complete.',
  },
  {
    code: 'tryin.appointment_due',
    name: 'Try-in appointment reminder',
    description: 'A try-in appointment is coming up.',
    audiences: [A.PATIENT],
    isMandatoryInternal: false,
    variables: ['appointment_date', 'patient_name'],
    title: 'Try-in appointment',
    body: 'Dear {recipient_name}, your try-in at {clinic_name} is on {appointment_date}.',
  },
  {
    code: 'appointment.rescheduled_lab_delay',
    name: 'Appointment moved (lab delay)',
    description: 'An appointment moved because the lab work is late.',
    audiences: [A.PATIENT],
    isMandatoryInternal: false,
    variables: ['appointment_date', 'patient_name'],
    title: 'Appointment moved',
    body: 'Dear {recipient_name}, due to a lab delay your appointment at {clinic_name} is now on {appointment_date}.',
  },
  {
    code: 'payment.receipt',
    name: 'Payment receipt',
    description: 'A patient paid; send the receipt.',
    audiences: [A.PATIENT],
    isMandatoryInternal: false,
    variables: ['receipt_no', 'amount', 'patient_name'],
    title: 'Payment received',
    body: 'Dear {recipient_name}, {clinic_name} received {amount} (receipt {receipt_no}). Thank you.',
  },
  {
    code: 'payment.outstanding_reminder',
    name: 'Outstanding payment reminder',
    description: 'A patient has an unpaid balance.',
    audiences: [A.PATIENT],
    isMandatoryInternal: false,
    variables: ['amount', 'patient_name'],
    title: 'Payment reminder',
    body: 'Dear {recipient_name}, you have an outstanding balance of {amount} at {clinic_name}.',
  },
  // ── Clinic events (notifications + email plan, P4) ──────────────────
  {
    code: 'appointment.booked',
    name: 'Appointment booked',
    description: 'A new appointment was booked with you.',
    audiences: [A.DOCTOR],
    isMandatoryInternal: false,
    variables: ['patient_name', 'appointment_date'],
    title: 'New appointment: {patient_name}',
    body: '{patient_name} is booked with you on {appointment_date}.',
  },
  {
    code: 'appointment.rescheduled',
    name: 'Appointment moved',
    description: 'One of your appointments moved to another time (or to you).',
    audiences: [A.DOCTOR],
    isMandatoryInternal: false,
    variables: ['patient_name', 'appointment_date', 'previous_date'],
    title: 'Appointment moved: {patient_name}',
    body: '{patient_name} is now on {appointment_date} (was {previous_date}).',
  },
  {
    code: 'appointment.cancelled',
    name: 'Appointment cancelled',
    description: 'One of your appointments was cancelled.',
    audiences: [A.DOCTOR],
    isMandatoryInternal: false,
    variables: ['patient_name', 'appointment_date', 'reason'],
    title: 'Appointment cancelled: {patient_name}',
    body: 'The appointment of {patient_name} on {appointment_date} was cancelled. {reason}',
  },
  {
    code: 'queue.patient_checked_in',
    name: 'Patient waiting',
    description: 'A patient checked in to your queue.',
    audiences: [A.DOCTOR],
    isMandatoryInternal: false,
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    pushDefault: true,
    variables: ['patient_name', 'patient_first_name', 'token'],
    title: '{patient_name} is waiting ({token})',
    body: '{patient_name} checked in to your queue with token {token}.',
    // docs/03 §5: the lock screen may carry the patient's FIRST name and the
    // token only — never the full name or anything clinical.
    pushTitle: 'Patient checked in',
    pushBody: '{patient_first_name} · Token {token}',
  },
  {
    code: 'inventory.low_stock',
    name: 'Low stock (daily)',
    description:
      'Once a day: items at or below their reorder level, or out of stock.',
    audiences: [A.STAFF],
    isMandatoryInternal: false,
    emailDefault: true,
    variables: ['item_count', 'items', 'location_name'],
    title: '{item_count} item(s) low on stock at {location_name}',
    body: 'These items need reordering at {location_name}: {items}',
  },
  {
    code: 'inventory.expiring',
    name: 'Stock expiring (daily)',
    description: 'Once a day: batches that expire within 30 days.',
    audiences: [A.STAFF],
    isMandatoryInternal: false,
    emailDefault: true,
    variables: ['item_count', 'items', 'location_name'],
    title: '{item_count} item(s) expiring soon at {location_name}',
    body: 'These items expire soon at {location_name}: {items}',
  },
  {
    code: 'join_request.created',
    name: 'Someone asked to join',
    description:
      'A person asked to join the clinic (invite link or Google Workspace).',
    audiences: [A.STAFF],
    isMandatoryInternal: false,
    emailDefault: true,
    variables: ['requester_name', 'requester_email'],
    title: '{requester_name} asked to join {clinic_name}',
    body: '{requester_name} ({requester_email}) asked to join {clinic_name}. Approve or reject it under Employees.',
  },
  {
    code: 'join_request.approved',
    name: 'Join request approved',
    description: 'Your request to join a clinic was approved.',
    audiences: [A.STAFF],
    isMandatoryInternal: false,
    emailDefault: true,
    variables: [],
    title: 'Welcome to {clinic_name}',
    body: 'Dear {recipient_name}, your request to join {clinic_name} was approved. You can sign in now.',
  },
  {
    code: 'employee.login_created',
    name: 'Login created for you',
    description: 'A clinic gave you a login.',
    audiences: [A.STAFF],
    isMandatoryInternal: false,
    emailDefault: true,
    variables: ['login_email'],
    title: 'Your login for {clinic_name}',
    body: 'Dear {recipient_name}, {clinic_name} created a login for you ({login_email}). You can sign in now.',
  },
  {
    code: 'clinic.approved',
    name: 'Clinic approved',
    description: 'The platform approved your clinic registration.',
    audiences: [A.STAFF],
    isMandatoryInternal: true,
    emailDefault: true,
    variables: [],
    title: '{clinic_name} is approved',
    body: 'Dear {recipient_name}, {clinic_name} was approved. You and your team can start using it now.',
  },
  {
    code: 'clinic.rejected',
    name: 'Clinic not approved',
    description: 'The platform did not approve your clinic registration.',
    audiences: [A.STAFF],
    isMandatoryInternal: true,
    emailDefault: true,
    variables: ['reason'],
    title: '{clinic_name} was not approved',
    body: 'Dear {recipient_name}, the registration of {clinic_name} was not approved. {reason}',
  },
  {
    code: 'subscription.ending_soon',
    name: 'Subscription ending soon',
    description: 'The trial or paid period ends in a few days.',
    audiences: [A.STAFF],
    isMandatoryInternal: true,
    emailDefault: true,
    variables: ['days_left', 'ends_on'],
    title: '{clinic_name}: {days_left} day(s) left',
    body: 'The subscription of {clinic_name} ends on {ends_on} ({days_left} day(s) left). Renew under Settings → Subscription to keep working without interruption.',
  },
  {
    code: 'subscription.expired',
    name: 'Subscription ended',
    description: 'The trial or paid period ended; the clinic is read-only.',
    audiences: [A.STAFF],
    isMandatoryInternal: true,
    emailDefault: true,
    variables: ['ends_on'],
    title: '{clinic_name}: subscription ended',
    body: 'The subscription of {clinic_name} ended on {ends_on}. The clinic is read-only until it is renewed under Settings → Subscription.',
  },
  {
    code: 'payroll.generated',
    name: 'Payslip ready',
    description: 'Your payroll for a month was generated.',
    audiences: [A.STAFF],
    isMandatoryInternal: false,
    emailDefault: true,
    variables: ['period', 'net_amount'],
    title: 'Your payslip for {period}',
    body: 'Dear {recipient_name}, your payroll for {period} is ready: {net_amount}.',
  },
  {
    code: 'payroll.paid',
    name: 'Salary paid',
    description: 'Your salary for a month was marked paid.',
    audiences: [A.STAFF],
    isMandatoryInternal: false,
    emailDefault: true,
    variables: ['period', 'net_amount'],
    title: 'Salary paid for {period}',
    body: 'Dear {recipient_name}, your salary for {period} ({net_amount}) was paid.',
  },
];

/**
 * Channels an event can use: its own list ∩ its audiences' channels. Push is
 * opt-in per event — a null `channels` ("every channel of the audience") must
 * not start pushing every existing event (M1-04, docs/03 §5).
 */
export function eventChannels(e: {
  audiences: A[];
  channels?: NotificationChannel[] | null;
}): NotificationChannel[] {
  const byAudience = new Set(
    e.audiences.flatMap((a) => CHANNELS_BY_AUDIENCE[a]),
  );
  return [...byAudience].filter(
    (c) =>
      (!e.channels || e.channels.includes(c)) &&
      (c !== NotificationChannel.PUSH ||
        !!e.channels?.includes(NotificationChannel.PUSH)),
  );
}

/** Platform default templates: English, every channel any audience of the event uses. */
export function defaultTemplateSeeds(): {
  eventCode: string;
  channel: NotificationChannel;
  language: NotificationLanguage;
  subject: string | null;
  body: string;
}[] {
  return NOTIFICATION_EVENT_SEEDS.flatMap((e) => {
    return eventChannels(e).map((channel) => ({
      eventCode: e.code,
      channel,
      language: NotificationLanguage.EN,
      subject:
        channel === NotificationChannel.PUSH
          ? (e.pushTitle ?? e.title)
          : channel === NotificationChannel.IN_APP ||
              channel === NotificationChannel.EMAIL
            ? e.title
            : null,
      body:
        channel === NotificationChannel.PUSH ? (e.pushBody ?? e.body) : e.body,
    }));
  });
}
