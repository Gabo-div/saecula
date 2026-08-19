import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from 'react-native';
import { Text, View, YStack } from 'tamagui';

import { useStreakStore } from '@/store/streakStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

const AUTO_DISMISS_MS = 2600;

// Root overlay: shows a brief congratulation the first time a devotional action
// completes the day. Driven by streakStore.celebrate; auto-dismisses.
export function StreakCelebration() {
  const c = useAppTheme();
  const { t } = useTranslation();
  const count = useStreakStore((s) => s.celebrate);
  const clear = useStreakStore((s) => s.clearCelebrate);

  useEffect(() => {
    if (count == null) return;
    const id = setTimeout(clear, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [count, clear]);

  return (
    <Modal visible={count != null} animationType="fade" transparent onRequestClose={clear}>
      <View flex={1} bg="rgba(0,0,0,0.7)" items="center" justify="center" onPress={clear}>
        <YStack
          items="center"
          gap="$3"
          px="$8"
          py="$7"
          mx="$8"
          rounded={28}
          bg={c.bgElevated}
          borderWidth={1}
          borderColor={c.border}
        >
          <View
            width={88}
            height={88}
            rounded={44}
            bg={c.card}
            items="center"
            justify="center"
          >
            <MaterialCommunityIcons name="fire" size={48} color={c.accent} />
          </View>
          <Text color={c.strong} fontFamily={serif} fontSize={52} fontWeight="700" lineHeight={56}>
            {count ?? 0}
          </Text>
          <Text color={c.strong} fontFamily={serif} fontSize={20} fontWeight="600" text="center">
            {t('streak.completedTitle')}
          </Text>
          <Text color={c.muted} fontSize={13} text="center">
            {t('streak.keepGoing')}
          </Text>
        </YStack>
      </View>
    </Modal>
  );
}
