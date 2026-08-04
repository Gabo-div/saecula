import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { useLanguageStore } from '@/store/languageStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

const LOCALES: Record<string, string> = { en: 'en-US', es: 'es-ES', la: 'la' };

// All arithmetic is in UTC so a day never shifts across a timezone boundary,
// matching the ISO dates the readings screen uses.
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}
function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

// buildGrid always returns 42 cells (6 weeks), each either a day-of-month or
// null for the leading/trailing blanks. A fixed 6 rows keeps the sheet the
// same height for every month (some months span only 5 weeks). Weeks start
// Sunday.
const GRID_CELLS = 42;

function buildGrid(monthStart: Date): (number | null)[] {
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth();
  const firstWeekday = monthStart.getUTCDay(); // 0 = Sunday
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length < GRID_CELLS) cells.push(null);
  return cells;
}

export function DatePickerSheet({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const locale = LOCALES[language] ?? 'en-US';

  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseISO(value)));

  // Reopen on the selected day's month.
  useEffect(() => {
    if (visible) setViewMonth(startOfMonth(parseISO(value)));
  }, [visible, value]);

  const todayISO = isoDate(new Date());
  const year = viewMonth.getUTCFullYear();
  const month = viewMonth.getUTCMonth();

  let monthLabel = `${year}-${month + 1}`;
  try {
    monthLabel = viewMonth.toLocaleDateString(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    // keep fallback
  }

  // Localized single-letter weekday headers, Sunday first.
  const weekdays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(2024, 8, 1 + i)); // 2024-09-01 was a Sunday
    let label = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][i];
    try {
      label = d.toLocaleDateString(locale, { weekday: 'narrow', timeZone: 'UTC' });
    } catch {
      // keep fallback
    }
    weekdays.push(label);
  }

  const cells = buildGrid(viewMonth);

  const pick = (day: number) => {
    onSelect(isoDate(new Date(Date.UTC(year, month, day))));
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View flex={1} bg="rgba(0,0,0,0.6)" justify="flex-end" onPress={onClose}>
        {/* Stop taps inside the sheet from closing it. */}
        <YStack
          bg={c.bgElevated}
          borderTopLeftRadius={24}
          borderTopRightRadius={24}
          borderWidth={1}
          borderColor={c.border}
          pb={insets.bottom + 12}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Month stepper */}
          <XStack items="center" justify="space-between" px="$4" py="$3">
            <View
              width={40}
              height={40}
              rounded={20}
              bg={c.chip}
              items="center"
              justify="center"
              onPress={() => setViewMonth((m) => addMonths(m, -1))}
              pressStyle={{ opacity: 0.7 }}
            >
              <MaterialCommunityIcons name="chevron-left" size={24} color={c.accent} />
            </View>
            <Text color={c.strong} fontFamily={serif} fontSize={17}>
              {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
            </Text>
            <View
              width={40}
              height={40}
              rounded={20}
              bg={c.chip}
              items="center"
              justify="center"
              onPress={() => setViewMonth((m) => addMonths(m, 1))}
              pressStyle={{ opacity: 0.7 }}
            >
              <MaterialCommunityIcons name="chevron-right" size={24} color={c.accent} />
            </View>
          </XStack>

          {/* Weekday header */}
          <XStack px="$4">
            {weekdays.map((w, i) => (
              <View key={i} flex={1} items="center" py="$1">
                <Text color={c.muted} fontSize={11} fontWeight="700">
                  {w.toUpperCase()}
                </Text>
              </View>
            ))}
          </XStack>

          {/* Day grid */}
          <YStack px="$4" pt="$1" gap="$1">
            {Array.from({ length: cells.length / 7 }, (_, row) => (
              <XStack key={row}>
                {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                  if (day == null) {
                    return <View key={col} flex={1} height={40} />;
                  }
                  const iso = isoDate(new Date(Date.UTC(year, month, day)));
                  const selected = iso === value;
                  const isToday = iso === todayISO;
                  return (
                    <View key={col} flex={1} items="center" py="$1">
                      <View
                        width={36}
                        height={36}
                        rounded={18}
                        items="center"
                        justify="center"
                        bg={selected ? c.accent : 'transparent'}
                        borderWidth={isToday && !selected ? 1 : 0}
                        borderColor={c.accent}
                        onPress={() => pick(day)}
                        pressStyle={{ opacity: 0.7 }}
                      >
                        <Text
                          color={selected ? c.bg : c.strong}
                          fontSize={15}
                          fontWeight={selected || isToday ? '700' : '400'}
                        >
                          {day}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </XStack>
            ))}
          </YStack>

          {/* Jump to today */}
          <XStack px="$4" pt="$3">
            <View
              flex={1}
              items="center"
              py="$3"
              rounded="$6"
              bg={c.chip}
              borderWidth={1}
              borderColor={c.border}
              onPress={() => {
                onSelect(todayISO);
                onClose();
              }}
              pressStyle={{ opacity: 0.7 }}
            >
              <Text color={c.accent} fontSize={14} fontWeight="600">
                {t('calendar.today')}
              </Text>
            </View>
          </XStack>
        </YStack>
      </View>
    </Modal>
  );
}
