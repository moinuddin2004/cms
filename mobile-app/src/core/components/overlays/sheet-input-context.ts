import { createContext, useContext } from 'react';

/**
 * `true` inside a `FormSheet`. `FormInput` reads it and renders the library's
 * `BottomSheetTextInput`: gorhom only reacts to the keyboard once a focused
 * `BottomSheetTextInput` has set its keyboard `target` (useAnimatedKeyboard.ts),
 * so a plain `TextInput` leaves the sheet — and the sticky submit — under the keyboard.
 */
export const SheetInputContext = createContext(false);

export function useInSheet(): boolean {
  return useContext(SheetInputContext);
}
