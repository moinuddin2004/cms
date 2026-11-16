import { useForm, useStore } from '@tanstack/react-form';

import { profileDefaults, toCreateInput, toUpdateInput } from '../lib/profile-input';
import { profileSchema } from '../schemas/profile.schema';
import type { Profile } from '../types/profiles.types';
import { useCreateProfile, useUpdateProfile } from './useProfileMutations';

/**
 * The add / edit family-member form. With `profile` it edits (sends only what
 * changed; nothing changed = no request), without it adds a member. A failed
 * submit keeps the values (the mutation already toasted). `isDirty` drives
 * "Discard changes?".
 */
export function useProfileForm(profile: Profile | undefined, onDone: () => void) {
  const create = useCreateProfile();
  const update = useUpdateProfile(profile?.id ?? '');

  const form = useForm({
    defaultValues: profileDefaults(profile),
    validators: { onChange: profileSchema, onSubmit: profileSchema },
    onSubmit: async ({ value, formApi }) => {
      try {
        if (profile) {
          const input = toUpdateInput(value, profile);
          if (Object.keys(input).length > 0) await update.mutateAsync(input);
        } else {
          await create.mutateAsync(toCreateInput(value));
        }
      } catch {
        return; // already toasted by the mutation
      }
      formApi.reset(profileDefaults(profile));
      onDone();
    },
  });

  const isDirty = useStore(form.store, (s) => s.isDirty);
  return { form, isDirty };
}
