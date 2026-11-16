import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner-native';

import { extractErrorCode } from '@/core/http';
import { t } from '@/core/i18n';

import { createProfile, removeProfile, updateProfile } from '../api/profiles.api';
import { profileKeys } from '../api/profiles.keys';
import type { CreateProfileInput, Profile, UpdateProfileInput } from '../types/profiles.types';

type FailureKey = 'family.sheet.addFailed' | 'family.sheet.saveFailed' | 'family.detail.removeFailed';

/** Friendly copy for a failed write: never the server text (it may name a person). */
function failureMessage(err: unknown, fallback: FailureKey): string {
  const code = extractErrorCode(err);
  if (code === 'TOO_MANY_PROFILES') return t('family.sheet.tooMany');
  if (code === 'PROFILE_HAS_LINKS') return t('family.detail.removeBlocked');
  return t(fallback);
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  return useMutation<Profile, unknown, CreateProfileInput>({
    mutationFn: createProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.all }),
    onError: (err) => toast.error(failureMessage(err, 'family.sheet.addFailed')),
  });
}

export function useUpdateProfile(id: string) {
  const queryClient = useQueryClient();
  return useMutation<Profile, unknown, UpdateProfileInput>({
    mutationFn: (input) => updateProfile(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.all }),
    onError: (err) => toast.error(failureMessage(err, 'family.sheet.saveFailed')),
  });
}

export function useRemoveProfile() {
  const queryClient = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: removeProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.all }),
    onError: (err) => toast.error(failureMessage(err, 'family.detail.removeFailed')),
  });
}
