// Core component kit (docs/05 §6). `QrCode` joins in M2-15.
export { IconButton, type IconButtonProps } from './layout/IconButton';
export { Screen, type ScreenProps } from './layout/Screen';
export { ScreenHeader, type ScreenHeaderProps } from './layout/ScreenHeader';
export { ListRow, type ListRowProps } from './layout/ListRow';
export { SectionHeader, type SectionHeaderProps } from './layout/SectionHeader';
export { FAB, type FABProps } from './layout/FAB';
export { Spinner, type SpinnerProps } from './layout/Spinner';

export { StatusBadge, type StatusBadgeProps } from './data-display/StatusBadge';
export { TokenBadge, type TokenBadgeProps } from './data-display/TokenBadge';
export { Avatar, type AvatarProps } from './data-display/Avatar';
export { AVATAR_TINTS, avatarTintIndex, initialsOf } from './data-display/avatar-tint';
export { StatTile, type StatTileProps } from './data-display/StatTile';
export * from './data-display/status-tones';

export { EmptyState } from './feedback/EmptyState';
export { ErrorState } from './feedback/ErrorState';
export { LoadingSkeleton } from './feedback/LoadingSkeleton';
export { NoResultsState } from './feedback/NoResultsState';
export { OfflineBanner, type OfflineBannerProps } from './feedback/OfflineBanner';
export { ConnectionPill, type ConnectionPillProps } from './feedback/ConnectionPill';
export { deriveConnectionState, type ConnectionState } from './feedback/connection-state';

export { FieldWrapper } from './forms/FieldWrapper';
export { OfflineAwareButton, type OfflineAwareButtonProps } from './forms/OfflineAwareButton';
export { FormInput } from './forms/FormInput';
export { fieldError } from './forms/fieldError';
export { SearchBar, type SearchBarProps } from './forms/SearchBar';
export { FilterChips, type FilterChipsProps, type FilterChipOption } from './forms/FilterChips';
export { SegmentedControl, type SegmentedControlProps, type Segment } from './forms/SegmentedControl';

export { FormSheet, type FormSheetProps } from './overlays/FormSheet';
export { ActionSheet, type ActionSheetProps, type SheetAction } from './overlays/ActionSheet';
export { ConfirmDialog, type ConfirmDialogProps } from './overlays/ConfirmDialog';
