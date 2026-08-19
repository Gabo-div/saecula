import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';

import { fetchCalendarYear } from '@/api/client';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Sheet } from '@/components/Sheet';
import type { CalendarStackParamList } from '@/navigation/RootTabs';
import { useLanguageStore } from '@/store/languageStore';
import { useAppTheme } from '@/store/themeStore';
import { serif, type ThemeColor } from '@/theme/colors';
import { liturgicalColor, rankOrder } from '@/theme/liturgical';
import type { Celebration } from '@/types/api';

type Props = NativeStackScreenProps<CalendarStackParamList, 'Celebrations'>;

const LOCALES: Record<string, string> = { en: 'en-US', es: 'es-ES', la: 'la' };

// Month arithmetic in UTC to match the ISO dates the API keys on.
function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function shortDate(iso: string, locale: string): string {
  try {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

function longDate(iso: string, locale: string): string {
  try {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

interface SeasonRun {
  season: string;
  name: string;
  color: ThemeColor;
  start: string;
  end: string;
}

interface FeastEntry {
  iso: string;
  cel: Celebration;
}

// The celebrations screen presents the temporal cycle a month at a time: the
// liturgical seasons touching the month, then its solemnities and feasts in
// date order. The santoral (saints) lives on its own screen.
export function CelebrationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const locale = LOCALES[language] ?? 'en-US';

  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [days, setDays] = useState<Record<string, Celebration[]> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FeastEntry | null>(null);

  const year = viewMonth.getUTCFullYear();
  const month = viewMonth.getUTCMonth();
  const monthPrefix = `${year}-${pad(month + 1)}-`;

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
      return `${year}-${pad(month + 1)}`;
    }
  }, [viewMonth, locale, year, month]);

  const sortedDates = useMemo(() => (days ? Object.keys(days).sort() : []), [days]);

  // Contiguous same-season spans across the whole year, then kept only if they
  // overlap the viewed month. Full ranges are shown (not clipped) so a season
  // straddling the month still reads with its true start and end.
  const seasons = useMemo<SeasonRun[]>(() => {
    if (!days) return [];
    const runs: SeasonRun[] = [];
    for (const iso of sortedDates) {
      const primary = days[iso][0];
      if (!primary?.season) continue;
      const last = runs[runs.length - 1];
      if (last && last.season === primary.season) {
        last.end = iso;
      } else {
        runs.push({
          season: primary.season,
          name: primary.season_name,
          color: liturgicalColor(primary.colors[0]),
          start: iso,
          end: iso,
        });
      }
    }
    const monthStart = `${monthPrefix}01`;
    const monthEnd = `${monthPrefix}31`;
    return runs.filter((r) => r.start <= monthEnd && r.end >= monthStart);
  }, [days, sortedDates, monthPrefix]);

  // Solemnities and feasts within the viewed month, in date order.
  const feasts = useMemo<FeastEntry[]>(() => {
    if (!days) return [];
    const out: FeastEntry[] = [];
    for (const iso of sortedDates) {
      if (!iso.startsWith(monthPrefix)) continue;
      const top = [...days[iso]]
        .filter((x) => x.rank === 'SOLEMNITY' || x.rank === 'FEAST')
        .sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank))[0];
      if (top) out.push({ iso, cel: top });
    }
    return out;
  }, [days, sortedDates, monthPrefix]);

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader title={t('calendar.celebrations')} onBack={() => navigation.goBack()} />

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

      {days && !loading && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 32 }}>
          {/* Seasons */}
          {seasons.length > 0 && (
            <YStack gap="$3">
              <Text fontSize={11} fontWeight="700" color={c.accent} letterSpacing={1.5}>
                {t('calendar.seasons').toUpperCase()}
              </Text>
              {seasons.map((s, i) => (
                <XStack key={`${s.season}-${i}`} gap="$3" items="center">
                  <View width={4} height={36} rounded={2} bg={s.color} />
                  <YStack flex={1}>
                    <Text color={c.strong} fontFamily={serif} fontSize={16}>
                      {s.name}
                    </Text>
                    <Text color={c.muted} fontSize={12}>
                      {shortDate(s.start, locale)} – {shortDate(s.end, locale)}
                    </Text>
                  </YStack>
                </XStack>
              ))}
            </YStack>
          )}

          {/* Solemnities & feasts */}
          <YStack gap="$3">
            <Text fontSize={11} fontWeight="700" color={c.accent} letterSpacing={1.5}>
              {t('calendar.solemnitiesAndFeasts').toUpperCase()}
            </Text>
            {feasts.length === 0 && (
              <Text color={c.muted} fontSize={13}>
                {t('calendar.celebrationsEmpty')}
              </Text>
            )}
            {feasts.map((f, i) => (
              <XStack
                key={`${f.iso}-${i}`}
                gap="$3"
                items="flex-start"
                onPress={() => setSelected(f)}
                pressStyle={{ opacity: 0.6 }}
              >
                <Text color={c.muted} fontSize={12} width={52} mt={2}>
                  {shortDate(f.iso, locale)}
                </Text>
                <View
                  width={8}
                  height={8}
                  rounded={4}
                  mt={6}
                  bg={liturgicalColor(f.cel.colors[0])}
                />
                <YStack flex={1}>
                  <Text color={c.text} fontFamily={serif} fontSize={15} lineHeight={20}>
                    {f.cel.name}
                  </Text>
                  <XStack gap="$2" items="center">
                    <Text color={c.muted} fontSize={11}>
                      {f.cel.rank_name}
                    </Text>
                    {f.cel.holy_day && (
                      <Text color={c.accent} fontSize={11}>
                        · {t('calendar.holyDay')}
                      </Text>
                    )}
                  </XStack>
                </YStack>
              </XStack>
            ))}
          </YStack>
        </ScrollView>
      )}

      <Sheet
        visible={selected !== null}
        onClose={() => setSelected(null)}
        grabber={false}
        padBottom={16}
      >
        <YStack px="$4" pt="$4" gap="$3">
            {selected && (
              <>
                <XStack items="center" justify="space-between">
                  <Text color={c.muted} fontSize={12}>
                    {longDate(selected.iso, locale)}
                  </Text>
                  <MaterialCommunityIcons
                    name="close"
                    size={24}
                    color={c.muted}
                    onPress={() => setSelected(null)}
                  />
                </XStack>

                <XStack gap="$3" items="flex-start">
                  <View
                    width={10}
                    height={10}
                    rounded={5}
                    mt={8}
                    bg={liturgicalColor(selected.cel.colors[0])}
                  />
                  <Text color={c.strong} fontFamily={serif} fontSize={22} lineHeight={28} flex={1}>
                    {selected.cel.name}
                  </Text>
                </XStack>

                <XStack gap="$2" items="center" flexWrap="wrap">
                  <Text color={c.text} fontSize={13}>
                    {selected.cel.rank_name}
                  </Text>
                  {selected.cel.season_name && (
                    <Text color={c.muted} fontSize={13}>
                      · {selected.cel.season_name}
                    </Text>
                  )}
                  {selected.cel.holy_day && (
                    <Text color={c.accent} fontSize={13}>
                      · {t('calendar.holyDay')}
                    </Text>
                  )}
                  {selected.cel.optional && (
                    <Text color={c.muted} fontSize={13} fontStyle="italic">
                      · {t('calendar.optional')}
                    </Text>
                  )}
                </XStack>

                <XStack
                  items="center"
                  justify="center"
                  gap="$2"
                  mt="$2"
                  py="$3"
                  rounded="$6"
                  bg={c.accent}
                  onPress={() => {
                    const iso = selected.iso;
                    setSelected(null);
                    navigation.navigate('DailyReadings', { date: iso });
                  }}
                  pressStyle={{ opacity: 0.8 }}
                >
                  <MaterialCommunityIcons name="book-open-variant" size={18} color={c.bg} />
                  <Text color={c.bg} fontSize={14} fontWeight="600">
                    {t('calendar.readings')}
                  </Text>
                </XStack>
              </>
            )}
        </YStack>
      </Sheet>
    </View>
  );
}
