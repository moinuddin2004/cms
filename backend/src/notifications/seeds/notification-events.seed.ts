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
  variables: string[];
  /** Platform default wording (English). Title doubles as email subject. */
  title: string;
  body: string;
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
];

/** Platform default templates: English, every channel any audience of the event uses. */
export function defaultTemplateSeeds(): {
  eventCode: string;
  channel: NotificationChannel;
  language: NotificationLanguage;
  subject: string | null;
  body: string;
}[] {
  return NOTIFICATION_EVENT_SEEDS.flatMap((e) => {
    const channels = new Set(
      e.audiences.flatMap((a) => CHANNELS_BY_AUDIENCE[a]),
    );
    return [...channels].map((channel) => ({
      eventCode: e.code,
      channel,
      language: NotificationLanguage.EN,
      subject:
        channel === NotificationChannel.IN_APP ||
        channel === NotificationChannel.EMAIL
          ? e.title
          : null,
      body: e.body,
    }));
  });
}
