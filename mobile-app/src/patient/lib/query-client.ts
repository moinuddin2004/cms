import { createQueryClient } from '@/core/query/create-query-client';

import { PERSIST_MAX_AGE } from './persist';

/** The patient space's one query cache. Mounted by the patient layout, never shared with staff. */
export const patientQueryClient = createQueryClient({ gcTime: PERSIST_MAX_AGE });
