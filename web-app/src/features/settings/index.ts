// Settings feature barrel — import from here across features.
export { SettingsLayout } from './components/SettingsLayout'
export { SettingsCard, SettingsRow } from './components/SettingsCard'
export { useSettingsItems } from './hooks/useSettingsItems'
export { SettingsOverviewPage } from './pages/SettingsOverviewPage'
export { ProfileSettingsPage } from './pages/ProfileSettingsPage'
export { AppearanceSettingsPage } from './pages/AppearanceSettingsPage'
export { SecuritySettingsPage } from './pages/SecuritySettingsPage'
export { SessionsSettingsPage } from './pages/SessionsSettingsPage'
export {
  SETTINGS_ITEMS,
  SETTINGS_GROUPS,
  canSeeSettingsItem,
  type SettingsItemDef,
} from './lib/settings.registry'
