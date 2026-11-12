import { createQueryClient } from '@/core/query/create-query-client';

import { PERSIST_MAX_AGE } from './persist';

/**
 * The staff space's one query cache. Mounted by the staff layout, never shared.
 * gcTime = the persist maxAge, so restored / inactive queries survive 24 h.
 */
export const staffQueryClient = createQueryClient({ gcTime: PERSIST_MAX_AGE });
