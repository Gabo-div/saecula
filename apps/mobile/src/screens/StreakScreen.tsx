import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { fetchStreakHistory } from '@/api/client';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useLanguageStore } from '@/store/languageStore';
import { useStreakStore } from '@/store/streakStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

const LOCALES: Record<string, string> = { en: 'en-US', es: 'es-ES', la: 'es-ES' };

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function todayISO(): string {
  const d = new Date();
  return iso(d.getFullYear(), d.getMonth(), d.getDate());
}

// 42-cell grid (6 weeks), Monday-first, null for leading/trailing blanks.
function buildGrid(year: number, month: number): (number | null)[] {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = Monday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length < 42) cells.push(null);
  return cells;
}

export function StreakScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const language = useLanguageStore((s) => s.language);
  const locale = LOCALES[language] ?? 'en-US';
  const current = useStreakStore((s) => s.current);
  const best = useStreakStore((s) => s.best);

  const [view, setView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    const { year, month } = view;
    const from = iso(year, month, 1);
    const to = iso(year, month, new Date(year, month + 1, 0).getDate());
    fetchStreakHistory(from, to)
      .then((r) => setDone(new Set(r.entries.map((e) => e.day))))
      .catch(() => {});
  }, [view]);

  const monthLabel = useMemo(() => {
    const d = new Date(view.year, view.month, 1);
    try {
      const s = d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
      return s.charAt(0).toUpperCase() + s.slice(1);
    } catch {
      return `${view.year}-${view.month + 1}`;
    }
  }, [view, locale]);

  const weekdays = useMemo(() => {
    const base = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    return base.map((fallback, i) => {
      // 2024-01-01 was a Monday.
      const d = new Date(2024, 0, 1 + i);
      try {
        return d.toLocaleDateString(locale, { weekday: 'narrow' }).toUpperCase();
      } catch {
        return fallback;
      }
    });
  }, [locale]);

  const cells = useMemo(() => buildGrid(view.year, view.month), [view]);
  const tISO = todayISO();

  const step = (delta: number) =>
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const Stepper = ({ icon, onPress, testID }: { icon: 'chevron-left' | 'chevron-right'; onPress: () => void; testID: string }) => (
    <View
      testID={testID}
      width={40}
      height={40}
      rounded={20}
      bg={c.chip}
      items="center"
      justify="center"
      onPress={onPress}
      pressStyle={{ opacity: 0.7 }}
    >
      <MaterialCommunityIcons name={icon} size={24} color={c.accent} />
    </View>
  );

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader title={t('streak.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Hero: current streak in serif, best beside it */}
        <XStack px="$5" pt="$4" pb="$6" items="flex-end" gap="$6">
          <YStack>
            <XStack items="center" gap="$2">
              <MaterialCommunityIcons name="fire" size={40} color={c.accent} />
              <Text color={c.strong} fontFamily={serif} fontSize={64} fontWeight="700" lineHeight={64}>
                {current}
              </Text>
            </XStack>
            <Text color={c.muted} fontSize={13} pl="$1">
              {t('streak.current')}
            </Text>
          </YStack>
          <YStack pb="$2">
            <Text color={c.text} fontFamily={serif} fontSize={28} fontWeight="700">
              {best}
            </Text>
            <Text color={c.muted} fontSize={13}>
              {t('streak.best')}
            </Text>
          </YStack>
        </XStack>

        {/* Month stepper */}
        <XStack items="center" justify="space-between" px="$5" pb="$3">
          <Stepper icon="chevron-left" onPress={() => step(-1)} testID="streak-prev-month" />
          <Text color={c.strong} fontFamily={serif} fontSize={18}>
            {monthLabel}
          </Text>
          <Stepper icon="chevron-right" onPress={() => step(1)} testID="streak-next-month" />
        </XStack>

        {/* Weekday header */}
        <XStack px="$5">
          {weekdays.map((w, i) => (
            <View key={i} flex={1} items="center" py="$1">
              <Text color={c.muted} fontSize={11} fontWeight="700">
                {w}
              </Text>
            </View>
          ))}
        </XStack>

        {/* Heatmap grid */}
        <YStack px="$5" pt="$1" gap="$2">
          {Array.from({ length: 6 }, (_, row) => (
            <XStack key={row} gap="$2">
              {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                if (day == null) return <View key={col} flex={1} aspectRatio={1} />;
                const cellISO = iso(view.year, view.month, day);
                const isDone = done.has(cellISO);
                const isToday = cellISO === tISO;
                // Constant border on every cell keeps the box size identical;
                // only today's border is visible (a light ring when the day is
                // done, a gold ring when it isn't) so today stands apart from
                // the other days in either state.
                return (
                  <View
                    key={col}
                    flex={1}
                    aspectRatio={1}
                    rounded="$4"
                    items="center"
                    justify="center"
                    bg={isDone ? c.accent : c.bgElevated}
                    borderWidth={2}
                    borderColor={isToday ? (isDone ? c.strong : c.accent) : 'transparent'}
                  >
                    <Text
                      color={isDone ? c.bg : c.muted}
                      fontSize={14}
                      fontWeight={isDone || isToday ? '700' : '400'}
                    >
                      {day}
                    </Text>
                  </View>
                );
              })}
            </XStack>
          ))}
        </YStack>
      </ScrollView>
    </View>
  );
}
