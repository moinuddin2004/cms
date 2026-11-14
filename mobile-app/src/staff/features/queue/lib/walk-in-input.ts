import type { WalkInValues } from '../schemas/walk-in.schema';
import type { WalkInInput } from '../types/queue.types';

/**
 * Form values -> the `POST /queue/walk-ins` body. Sends only the documented
 * fields (the backend rejects unknown ones): an existing patient by id, or a
 * new one by name + phone; blank optional fields are left out.
 */
export function toWalkInInput(v: WalkInValues): WalkInInput {
  const out: WalkInInput = { doctorId: v.doctorId };
  if (v.mode === 'existing') {
    out.patientId = v.patientId;
  } else {
    out.patientName = v.fullName.trim();
    out.patientPhone = v.phone.trim();
  }
  const reason = v.reasonForVisit.trim();
  if (reason) out.reasonForVisit = reason;
  if (v.urgent) out.urgentReason = v.urgentReason.trim();
  return out;
}
