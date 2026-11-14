import type { BoardResponse } from '@/staff/features/queue';

import type { DoctorNow } from '../types/today.types';

/** Board lanes → one "Doctors now" row each, in lane order. */
export function toDoctorsNow(board: BoardResponse): DoctorNow[] {
  return board.lanes.map(({ doctor, snapshot }) => {
    if (!snapshot) {
      return {
        doctorId: doctor.id,
        doctorName: doctor.fullName,
        status: 'no_session',
        nowServing: null,
        nowServingStatus: null,
        waitingCount: 0,
      };
    }
    const entries = snapshot.entries;
    // A patient in consultation outranks one merely called.
    const serving =
      entries.find((e) => e.status === 'in_consultation') ??
      entries.find((e) => e.status === 'called') ??
      null;
    return {
      doctorId: doctor.id,
      doctorName: doctor.fullName,
      status: snapshot.session.status,
      nowServing: serving?.token ?? null,
      nowServingStatus:
        serving?.status === 'in_consultation' || serving?.status === 'called'
          ? serving.status
          : null,
      waitingCount: entries.filter((e) => e.status === 'waiting').length,
    };
  });
}
