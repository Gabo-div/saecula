import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { ScreenHeader } from '@/components/ScreenHeader';
import { fetchStreakHistory, todayLocalISO } from '@/api/client';
import { useAppTheme } from '@/store/themeStore';
import { useStreakStore } from '@/store/streakStore';

const WINDOW_DAYS = 35;

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function StreakScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { current, best } = useStreakStore();
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchStreakHistory(isoDaysAgo(WINDOW_DAYS - 1), todayLocalISO())
      .then((r) => setDone(new Set(r.entries.map((e) => e.day))))
      .catch(() => {});
  }, []);

  const cells = useMemo(
    () => Array.from({ length: WINDOW_DAYS }, (_, i) => isoDaysAgo(WINDOW_DAYS - 1 - i)),
    [],
  );

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader title={t('streak.title')} onBack={() => navigation.goBack()} />
      <ScrollView>
        <YStack p="$4" gap="$5">
          <XStack gap="$6">
            <YStack>
              <Text color={c.strong} fontSize={32} fontWeight="700">
                🔥 {current}
              </Text>
              <Text color={c.muted} fontSize={12}>
                {t('streak.current')}
              </Text>
            </YStack>
            <YStack>
              <Text color={c.strong} fontSize={32} fontWeight="700">
                {best}
              </Text>
              <Text color={c.muted} fontSize={12}>
                {t('streak.best')}
              </Text>
            </YStack>
          </XStack>

          <XStack flexWrap="wrap" gap="$2">
            {cells.map((iso) => (
              <View
                key={iso}
                width={36}
                height={36}
                rounded="$4"
                bg={done.has(iso) ? c.accent : c.card}
              />
            ))}
          </XStack>
        </YStack>
      </ScrollView>
    </View>
  );
}
