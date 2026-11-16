import { isHexColor } from '@/core/theme/brand';

import type { ClinicRef } from '../types/records.types';

/** The clinic accent colour, only when it is a valid hex (it comes from the API). */
export const clinicAccent = (clinic: ClinicRef): string | null =>
  clinic.brandColor && isHexColor(clinic.brandColor) ? clinic.brandColor : null;

/** A paused clinic (A-19): its records stay readable, we just say so calmly. */
export const isClinicPaused = (clinic: ClinicRef): boolean => clinic.clinicStatus === 'suspended';
