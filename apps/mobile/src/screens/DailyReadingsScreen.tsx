import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';

import { fetchDailyReadings } from '@/api/client';
import { DatePickerSheet } from '@/components/DatePickerSheet';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { CalendarStackParamList } from '@/navigation/RootTabs';
import { useLanguageStore } from '@/store/languageStore';
import { useStreakStore } from '@/store/streakStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';
import type { DailyReadingsResponse } from '@/types/api';

type Props = NativeStackScreenProps<CalendarStackParamList, 'DailyReadings'>;

const LOCALES: Record<string, string> = { en: 'en-US', es: 'es-ES', la: 'la' };

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

export function DailyReadingsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);

  const [date, setDate] = useState(route.params?.date ?? isoDate(new Date()));
  const [data, setData] = useState<DailyReadingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchDailyReadings(date));
      useStreakStore.getState().checkin('readings');
    } catch {
      setData(null);
      setError(t('calendar.noReadings'));
    } finally {
      setLoading(false);
    }
  }, [date, language]);

  useEffect(() => {
    void load();
  }, [load]);

  const locale = LOCALES[language] ?? 'en-US';
  let dateLabel = date;
  try {
    dateLabel = new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });
  } catch {
    // keep ISO fallback
  }

  const readingLabel = (type: string) =>
    t(`calendar.readingTypes.${type}`, {
      defaultValue: type.replace(/_/g, ' '),
    });

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader title={t('calendar.readings')} onBack={() => navigation.goBack()} />

      {/* Date stepper */}
      <XStack items="center" px="$4" py="$2" gap="$2">
        <View
          testID="readings-prev-day"
          width={40}
          height={40}
          rounded={20}
          bg={c.chip}
          items="center"
          justify="center"
          onPress={() => setDate((d) => shiftDate(d, -1))}
          pressStyle={{ opacity: 0.7 }}
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color={c.accent} />
        </View>
        <XStack
          testID="readings-date"
          height={40}
          items="center"
          justify="center"
          gap="$2"
          px="$3"
          flex={1}
          rounded={20}
          bg={c.chip}
          onPress={() => setPickerOpen(true)}
          pressStyle={{ opacity: 0.7 }}
        >
          <Text color={c.strong} fontFamily={serif} fontSize={16} lineHeight={20}>
            {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
          </Text>
          <MaterialCommunityIcons name="calendar-month-outline" size={16} color={c.accent} />
        </XStack>
        <View
          testID="readings-next-day"
          width={40}
          height={40}
          rounded={20}
          bg={c.chip}
          items="center"
          justify="center"
          onPress={() => setDate((d) => shiftDate(d, 1))}
          pressStyle={{ opacity: 0.7 }}
        >
          <MaterialCommunityIcons name="chevron-right" size={24} color={c.accent} />
        </View>
      </XStack>

      {loading && <Spinner mt="$4" size="large" color={c.accent} />}
      {error && !loading && (
        <Text color={c.muted} self="center" mt="$8" px="$8" text="center">
          {error}
        </Text>
      )}

      {data && !loading && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
          {data.readings.map((reading, i) => (
            <YStack key={`${reading.type}-${i}`} gap="$2">
              <XStack items="center" gap="$2">
                <Text
                  fontSize={11}
                  fontWeight="700"
                  color={c.accent}
                  letterSpacing={1.5}
                >
                  {readingLabel(reading.type).toUpperCase()}
                </Text>
              </XStack>
              <Text color={c.strong} fontFamily={serif} fontSize={17}>
                {reading.reference}
              </Text>
              <YStack
                gap="$2"
                p="$4"
                rounded="$6"
                bg={c.bgElevated}
                borderWidth={1}
                borderColor={c.border}
              >
                {reading.verses.map((v) => (
                  <Text key={v.entity_id} color={c.text} fontFamily={serif} fontSize={15} lineHeight={24}>
                    <Text color={c.accent} fontSize={11}>
                      {v.number}{' '}
                    </Text>
                    {v.text ?? '—'}
                  </Text>
                ))}
              </YStack>
            </YStack>
          ))}
        </ScrollView>
      )}

      <DatePickerSheet
        visible={pickerOpen}
        value={date}
        onSelect={setDate}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}
