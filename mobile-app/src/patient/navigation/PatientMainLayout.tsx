import { Stack } from 'expo-router';

/** The signed-in patient stack. Tabs, realtime and push registration join in later cards. */
export function PatientMainLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
