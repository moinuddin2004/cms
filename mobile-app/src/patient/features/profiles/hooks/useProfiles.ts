import { useQuery } from '@tanstack/react-query';

import { fetchProfiles } from '../api/profiles.api';
import { profileKeys } from '../api/profiles.keys';

/** The account's profiles (self + family) with their clinic links. */
export function useProfiles() {
  return useQuery({ queryKey: profileKeys.list(), queryFn: fetchProfiles });
}
