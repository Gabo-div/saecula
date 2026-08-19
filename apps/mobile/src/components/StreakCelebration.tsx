import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View, YStack } from 'tamagui';

import { fetchStreakHistory } from '@/api/client';
import { Sheet } from '@/components/Sheet';
import { WeekStrip, localISO, mondayOf } from '@/components/WeekStrip';
import { useStreakStore } from '@/store/streakStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

// Bottom sheet celebrating the first devotional action that completes the day.
// Driven by streakStore.celebrate; dismissed by tapping the scrim or the button.
// (A RN Modal only renders reliably inside the navigator tree, so this is
// mounted from RootTabs, not as a sibling of NavigationContainer.)
export function StreakCelebration() {
  const c = useAppTheme();
  const { t } = useTranslation();
  const count = useStreakStore((s) => s.celebrate);
  const clear = useStreakStore((s) => s.clearCelebrate);

  const [done, setDone] = useState<Set<string>>(new Set());

  // Load this week's completed days when the sheet opens (today's row already
  // exists — the check-in that triggered this created it).
  useEffect(() => {
    if (count == null) return;
    const today = new Date();
    fetchStreakHistory(localISO(mondayOf(today)), localISO(today))
      .then((r) => setDone(new Set(r.entries.map((e) => e.day))))
      .catch(() => {});
  }, [count]);

  return (
    <Sheet visible={count != null} onClose={clear} radius={28} padBottom={20} scrimOpacity={0.65}>
      <YStack items="center" gap="$3" px="$6" pt="$4">
            <View width={96} height={96} rounded={48} bg={c.card} items="center" justify="center">
              <MaterialCommunityIcons name="fire" size={52} color={c.accent} />
            </View>

            <Text color={c.strong} fontFamily={serif} fontSize={56} fontWeight="700" lineHeight={60}>
              {count ?? 0}
            </Text>
            <Text color={c.strong} fontFamily={serif} fontSize={22} fontWeight="600" text="center">
              {t('streak.completedTitle')}
            </Text>
            <Text color={c.muted} fontSize={14} text="center">
              {t('streak.keepGoing')}
            </Text>

            <View width="100%" mt="$2">
              <WeekStrip done={done} />
            </View>

            <View
              testID="streak-celebrate-continue"
              items="center"
              width="100%"
              mt="$3"
              py="$3.5"
              rounded="$8"
              bg={c.accent}
              onPress={clear}
              pressStyle={{ opacity: 0.85 }}
            >
              <Text color={c.bg} fontSize={15} fontWeight="700">
                {t('streak.continue')}
              </Text>
            </View>
      </YStack>
    </Sheet>
  );
}
