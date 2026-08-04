import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';

import { fetchCalendarYear } from '@/api/client';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { CalendarStackParamList } from '@/navigation/RootTabs';
import { useLanguageStore } from '@/store/languageStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';
import { liturgicalColor, rankOrder } from '@/theme/liturgical';
import type { Celebration } from '@/types/api';

type Props = NativeStackScreenProps<CalendarStackParamList, 'SaintsCalendar'>;

const LOCALES: Record<string, string> = { en: 'en-US', es: 'es-ES', la: 'la' };

// All month arithmetic is in UTC to match the ISO dates the API keys on.
function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

interface DayEntry {
  iso: string;
  day: number;
  weekday: string;
  cels: Celebration[];
}

// The saints calendar (santoral): the sanctoral cycle browsed a month at a
// time. It filters the full-year payload down to days that honor a saint,
// leaving the temporal cycle (Sundays, ferias, seasons) to the celebrations
// screen.
export function SaintsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const locale = LOCALES[language] ?? 'en-US';

  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [days, setDays] = useState<Record<string, Celebration[]> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const year = viewMonth.getUTCFullYear();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCalendarYear(year);
      setDays(res.days);
    } catch {
      setDays(null);
      setError(t('calendar.calendarLoadError'));
    } finally {
      setLoading(false);
    }
  }, [year, language, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthLabel = useMemo(() => {
    try {
      return viewMonth.toLocaleDateString(locale, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
    } catch {
      return `${year}-${pad(viewMonth.getUTCMonth() + 1)}`;
    }
  }, [viewMonth, locale, year]);

  // Days of the viewed month that carry at least one saint, primary first.
  const entries = useMemo<DayEntry[]>(() => {
    if (!days) return [];
    const month = viewMonth.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const out: DayEntry[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${pad(month + 1)}-${pad(d)}`;
      const cels = (days[iso] ?? [])
        .filter((x) => x.sanctoral)
        .sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank));
      if (cels.length === 0) continue;
      let weekday = '';
      try {
        weekday = new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, {
          weekday: 'short',
          timeZone: 'UTC',
        });
      } catch {
        // leave blank
      }
      out.push({ iso, day: d, weekday, cels });
    }
    return out;
  }, [days, viewMonth, year, locale]);

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader title={t('calendar.saints')} onBack={() => navigation.goBack()} />

      {/* Month stepper */}
      <XStack items="center" px="$4" py="$2" gap="$2">
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
        <View flex={1} height={40} items="center" justify="center" rounded={20} bg={c.chip}>
          <Text color={c.strong} fontFamily={serif} fontSize={16}>
            {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
          </Text>
        </View>
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

      {loading && <Spinner mt="$4" size="large" color={c.accent} />}
      {error && !loading && (
        <Text color={c.muted} self="center" mt="$8" px="$8" text="center">
          {error}
        </Text>
      )}

      {days && !loading && entries.length === 0 && (
        <Text color={c.muted} self="center" mt="$8" px="$8" text="center">
          {t('calendar.saintsEmpty')}
        </Text>
      )}

      {days && !loading && entries.length > 0 && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
          {entries.map((e) => (
            <XStack key={e.iso} gap="$3" items="flex-start">
              {/* Date block */}
              <YStack width={44} items="center">
                <Text color={c.strong} fontFamily={serif} fontSize={22} lineHeight={26}>
                  {e.day}
                </Text>
                <Text color={c.muted} fontSize={11} textTransform="uppercase">
                  {e.weekday}
                </Text>
              </YStack>

              {/* Celebrations that day */}
              <YStack flex={1} gap="$2">
                {e.cels.map((cel, i) => (
                  <XStack key={`${cel.id}-${i}`} gap="$2" items="flex-start">
                    <View
                      width={8}
                      height={8}
                      rounded={4}
                      mt={7}
                      bg={liturgicalColor(cel.colors[0])}
                    />
                    <YStack flex={1}>
                      <Text color={c.text} fontFamily={serif} fontSize={15} lineHeight={20}>
                        {cel.name}
                      </Text>
                      <XStack gap="$2" items="center">
                        <Text color={c.muted} fontSize={11}>
                          {cel.rank_name}
                        </Text>
                        {cel.optional && (
                          <Text color={c.muted} fontSize={11} fontStyle="italic">
                            · {t('calendar.optional')}
                          </Text>
                        )}
                      </XStack>
                    </YStack>
                  </XStack>
                ))}
              </YStack>
            </XStack>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
