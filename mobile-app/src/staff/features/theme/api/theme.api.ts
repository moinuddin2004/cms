import type { ApiResponse } from '@/core/types';
import { staffApi } from '@/staff/lib/api';

import type { ClinicTheme } from '../types/theme.types';

/** The active clinic's resolved theme (org + location), for the staff brand. */
export async function fetchTheme(): Promise<ClinicTheme> {
  const res = await staffApi.get<ApiResponse<ClinicTheme>>('/theme');
  return res.data.data;
}
