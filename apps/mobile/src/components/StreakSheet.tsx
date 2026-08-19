import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Separator, Text, View, XStack, YStack } from 'tamagui';

import { fetchStreakHistory } from '@/api/client';
import { WeekStrip, localISO, mondayOf } from '@/components/WeekStrip';
import { useStreakStore } from '@/store/streakStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

// weeksInARow counts consecutive Mon–Sun weeks (ending this week) that hold at
// least one active day. The current week counts once it has any activity.
function weeksInARow(done: Set<string>, today: Date): number {
  let weeks = 0;
  const cursor = mondayOf(today);
  for (;;) {
    let any = false;
    for (let i = 0; i < 7; i++) {
      const day = new Date(cursor);
      day.setDate(cursor.getDate() + i);
      if (done.has(localISO(day))) {
        any = true;
        break;
      }
    }
    if (!any) break;
    weeks += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return weeks;
}

export function StreakSheet({
  visible,
  onClose,
  onOpenHistory,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenHistory: () => void;
}) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const current = useStreakStore((s) => s.current);
  const best = useStreakStore((s) => s.best);

  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    const today = new Date();
    const from = `${today.getFullYear()}-01-01`;
    fetchStreakHistory(from, localISO(today))
      .then((r) => setDone(new Set(r.entries.map((e) => e.day))))
      .catch(() => {});
  }, [visible]);

  const daysThisYear = done.size;
  const weeks = weeksInARow(done, new Date());

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View flex={1} bg="rgba(0,0,0,0.6)" justify="flex-end" onPress={onClose}>
        <YStack
          bg={c.bgElevated}
          borderTopLeftRadius={28}
          borderTopRightRadius={28}
          borderWidth={1}
          borderColor={c.border}
          pb={insets.bottom + 20}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Grabber */}
          <View items="center" pt="$3" pb="$1">
            <View width={40} height={5} rounded={3} bg={c.border} />
          </View>

          <YStack px="$5" pt="$3" gap="$5">
            <Text color={c.strong} fontFamily={serif} fontSize={24} lineHeight={31} fontWeight="600">
              {t('streak.tagline')}
            </Text>

            {/* Current vs best, split by a hairline */}
            <XStack items="center">
              <YStack flex={1} items="center" gap="$1">
                <XStack items="center" gap="$2">
                  <MaterialCommunityIcons name="fire" size={30} color={c.accent} />
                  <Text color={c.strong} fontFamily={serif} fontSize={40} fontWeight="700">
                    {current}
                  </Text>
                </XStack>
                <Text color={c.muted} fontSize={12}>
                  {t('streak.current')}
                </Text>
              </YStack>

              <Separator vertical borderColor={c.border} height={48} />

              <YStack flex={1} items="center" gap="$1">
                <XStack items="center" gap="$2">
                  <MaterialCommunityIcons name="fire" size={26} color={c.muted} />
                  <Text color={c.text} fontFamily={serif} fontSize={40} fontWeight="700">
                    {best}
                  </Text>
                </XStack>
                <Text color={c.muted} fontSize={12}>
                  {t('streak.best')}
                </Text>
              </YStack>
            </XStack>

            {/* Meta line */}
            <Text color={c.muted} fontSize={13} text="center">
              {daysThisYear} {t('streak.daysThisYear')}
              {weeks > 0 ? `  ·  ${weeks} ${t('streak.weeks')}` : ''}
            </Text>

            <WeekStrip done={done} />

            {/* View history — primary action */}
            <View
              testID="streak-history"
              items="center"
              py="$3.5"
              rounded="$8"
              bg={c.accent}
              onPress={onOpenHistory}
              pressStyle={{ opacity: 0.85 }}
            >
              <Text color={c.bg} fontSize={15} fontWeight="700">
                {t('streak.history')}
              </Text>
            </View>
          </YStack>
        </YStack>
      </View>
    </Modal>
  );
}
