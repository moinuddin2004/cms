import { Redirect } from 'expo-router';
import { Bell, Plus, Share2, Trash2, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import {
  ActionSheet,
  Avatar,
  ConfirmDialog,
  ConnectionPill,
  EmptyState,
  ErrorState,
  FAB,
  FieldWrapper,
  FilterChips,
  FormInput,
  FormSheet,
  IconButton,
  ListRow,
  LoadingSkeleton,
  NoResultsState,
  OfflineBanner,
  Screen,
  ScreenHeader,
  SearchBar,
  SectionHeader,
  SegmentedControl,
  StatTile,
  StatusBadge,
  TokenBadge,
  APPOINTMENT_STATUS_TONES,
  DOSE_STATUS_TONES,
  QUEUE_STATUS_TONES,
  URGENT_BADGE,
} from '@/core/components';
import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <SectionHeader title={title} />
      <View className="gap-3 px-4">{children}</View>
    </View>
  );
}

/**
 * Dev-only component gallery (M1-01): every core component in every state, for
 * the light/dark and 1.3× font screenshots. Production builds redirect away.
 */
export function GalleryPage() {
  const [search, setSearch] = useState('');
  const [chips, setChips] = useState<string[]>(['today']);
  const [segment, setSegment] = useState('mine');
  const [sheet, setSheet] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [actions, setActions] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [name, setName] = useState('');

  if (!__DEV__) return <Redirect href="/more" />;

  return (
    <Screen
      scroll
      edges={['top']}
      floating={<FAB icon={Plus} label="Walk-in" extended onPress={() => undefined} />}
      banner={<OfflineBanner message="Offline — showing saved data from 10:42" />}
      header={
        <ScreenHeader
          title="Component gallery"
          subtitle="Dev only"
          actions={<IconButton icon={Bell} accessibilityLabel="Notifications" />}
        />
      }>
      <Group title="Buttons">
        <View className="flex-row flex-wrap items-center gap-2">
          <IconButton icon={Share2} accessibilityLabel="Share" variant="default" />
          <IconButton icon={Share2} accessibilityLabel="Share (outline)" variant="outline" />
          <IconButton icon={Trash2} accessibilityLabel="Delete" variant="destructive" />
          <IconButton icon={Bell} accessibilityLabel="Loading" loading />
          <IconButton icon={Bell} accessibilityLabel="Disabled" disabled />
        </View>
      </Group>

      <Group title="Status badges">
        <View className="flex-row flex-wrap gap-2">
          {Object.entries(QUEUE_STATUS_TONES).map(([key, spec]) => (
            <StatusBadge key={key} {...spec} />
          ))}
          <StatusBadge {...URGENT_BADGE} />
        </View>
        <View className="flex-row flex-wrap gap-2">
          {Object.entries(APPOINTMENT_STATUS_TONES).map(([key, spec]) => (
            <StatusBadge key={key} {...spec} />
          ))}
          {Object.entries(DOSE_STATUS_TONES).map(([key, spec]) => (
            <StatusBadge key={key} {...spec} variant="solid" />
          ))}
        </View>
      </Group>

      <Group title="Tokens, avatars, stats">
        <View className="flex-row flex-wrap items-center gap-3">
          <TokenBadge token="A-007" size="sm" />
          <TokenBadge token="A-007" />
          <TokenBadge token="A-007" size="lg" />
        </View>
        <View className="flex-row flex-wrap items-center gap-3">
          <Avatar name="Ali Raza" size="sm" />
          <Avatar name="Sara Khan" />
          <Avatar name="City Clinic" size="lg" />
          <Avatar name="Broken Image" imageUrl="https://invalid.example/none.png" />
        </View>
        <View className="flex-row gap-3">
          <StatTile label="Waiting" value={12} hint="+3 in the last hour" tone="warning" />
          <StatTile label="Done" value={48} tone="success" />
        </View>
        <ConnectionPill state="live" labels={{ live: 'Live', reconnecting: 'Reconnecting…', offline: 'Offline' }} />
        <ConnectionPill
          state="reconnecting"
          labels={{ live: 'Live', reconnecting: 'Reconnecting…', offline: 'Offline' }}
        />
        <ConnectionPill state="offline" labels={{ live: 'Live', reconnecting: 'Reconnecting…', offline: 'Offline' }} />
      </Group>

      <View className="gap-1">
        <SectionHeader title="Rows" count={3} action={{ label: 'See all', onPress: () => undefined }} />
        <ListRow
          leading={<Avatar name="Ali Raza" />}
          title="Ali Raza"
          subtitle="Scaling and polish with a very long description that must wrap"
          meta="10:42"
          trailing={<StatusBadge {...QUEUE_STATUS_TONES.waiting} />}
          onPress={() => undefined}
          onLongPress={() => setActions(true)}
        />
        <ListRow leading={<Avatar name="Sara Khan" />} title="Sara Khan" subtitle="Called" onPress={() => undefined} />
        <ListRow title="Disabled row" subtitle="Not tappable" disabled onPress={() => undefined} />
      </View>

      <Group title="Search and filters">
        <SearchBar value={search} onChange={setSearch} placeholder="Search patients" />
      </Group>
      <FilterChips
        options={[
          { value: 'today', label: 'Today' },
          { value: 'waiting', label: 'Waiting' },
          { value: 'urgent', label: 'Urgent' },
          { value: 'done', label: 'Done' },
        ]}
        value={chips}
        onChange={setChips}
        multiple
        clearLabel="Clear"
      />
      <Group title="Segmented control">
        <SegmentedControl
          segments={[
            { value: 'mine', label: 'My queue' },
            { value: 'board', label: 'Board' },
            { value: 'all', label: 'All' },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </Group>

      <Group title="Overlays">
        <View className="flex-row flex-wrap gap-2">
          <Button onPress={() => setSheet(true)}>
            <Text>Form sheet</Text>
          </Button>
          <Button variant="outline" onPress={() => setActions(true)}>
            <Text>Action sheet</Text>
          </Button>
          <Button variant="destructive" onPress={() => setConfirm(true)}>
            <Text>Confirm dialog</Text>
          </Button>
        </View>
      </Group>

      <Group title="Feedback states">
        <LoadingSkeleton rows={2} className="p-0" />
        <EmptyState title="No patients yet" description="Register the first patient." actionLabel="Add patient" onAction={() => undefined} className="py-6" />
        <NoResultsState onClear={() => undefined} />
        <ErrorState onRetry={() => undefined} className="py-6" />
      </Group>

      <FormSheet
        open={sheet}
        onClose={() => {
          setSheet(false);
          setDirty(false);
          setName('');
        }}
        title="Quick register"
        isDirty={dirty}
        closeLabel="Close"
        discard={{
          title: 'Discard changes?',
          description: 'Your entries will be lost.',
          confirmLabel: 'Discard',
          cancelLabel: 'Keep editing',
        }}
        error={name === 'error' ? "Couldn't save the patient. Try again." : undefined}
        submit={{ label: 'Save', disabled: name.length === 0, onPress: () => setSheet(false) }}>
        <FieldWrapper label="Name" required hint="Type “error” to see the server banner">
          <FormInput
            value={name}
            onChangeText={(v) => {
              setName(v);
              setDirty(v.length > 0);
            }}
            placeholder="Full name"
            autoComplete="name"
            textContentType="name"
            returnKeyType="done"
          />
        </FieldWrapper>
        <FieldWrapper label="Phone" error="Enter a valid number">
          <FormInput invalid keyboardType="phone-pad" placeholder="03xx xxxxxxx" />
        </FieldWrapper>
        <FieldWrapper label="Notes">
          <FormInput placeholder="Optional" />
        </FieldWrapper>
      </FormSheet>
      <ActionSheet
        open={actions}
        onClose={() => setActions(false)}
        title="Ali Raza"
        cancelLabel="Cancel"
        actions={[
          { label: 'Transfer', icon: UserPlus, onPress: () => undefined },
          { label: 'Cancel visit', icon: Trash2, destructive: true, onPress: () => setConfirm(true) },
        ]}
      />
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Cancel this visit?"
        description="The patient leaves the queue and is told the visit was cancelled."
        confirmLabel="Cancel visit"
        cancelLabel="Keep"
        destructive
        onConfirm={() => new Promise<void>((resolve) => setTimeout(resolve, 1200))}
      />
    </Screen>
  );
}
