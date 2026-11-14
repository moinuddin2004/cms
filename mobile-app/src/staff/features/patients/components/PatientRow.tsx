import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { memo } from 'react';
import { I18nManager } from 'react-native';

import { Avatar, ListRow } from '@/core/components';
import { Icon } from '@/core/ui/icon';
import { todayYmd } from '@/staff/lib/datetime';

import type { PatientListItem } from '../types/patients.types';
import { demographicsLine, idLine } from './patient-row-text';

interface PatientRowProps {
  patient: PatientListItem;
  onPress: (patientId: string) => void;
}

/** One patient in the list: initials, name, MR no. · masked phone, age · gender. */
export const PatientRow = memo(function PatientRow({ patient, onPress }: PatientRowProps) {
  const demographics = demographicsLine(patient.dob, patient.gender, todayYmd());
  const subtitle = [idLine(patient.patientNumber, patient.phone), demographics]
    .filter(Boolean)
    .join('\n');
  return (
    <ListRow
      leading={<Avatar name={patient.fullName} imageUrl={patient.profilePictureUrl} />}
      title={patient.fullName}
      subtitle={subtitle}
      accessibilityLabel={[patient.fullName, idLine(patient.patientNumber, patient.phone), demographics]
        .filter(Boolean)
        .join(', ')}
      trailing={
        <Icon
          as={I18nManager.isRTL ? ChevronLeft : ChevronRight}
          className="text-muted-foreground size-5"
        />
      }
      onPress={() => onPress(patient.id)}
    />
  );
});
