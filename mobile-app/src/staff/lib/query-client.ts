import { createQueryClient } from '@/core/query/create-query-client';

/** The staff space's one query cache. Mounted by the staff layout, never shared. */
export const staffQueryClient = createQueryClient();
