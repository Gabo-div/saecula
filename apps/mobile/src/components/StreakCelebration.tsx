import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, YStack } from 'tamagui';

import { useStreakStore } from '@/store/streakStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

// Bottom sheet celebrating the first devotional action that completes the day.
// Driven by streakStore.celebrate; dismissed by tapping the scrim or the button.
// (A RN Modal only renders reliably inside the navigator tree, so this is
// mounted from RootTabs, not as a sibling of NavigationContainer.)
export function StreakCelebration() {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const count = useStreakStore((s) => s.celebrate);
  const clear = useStreakStore((s) => s.clearCelebrate);

  return (
    <Modal visible={count != null} animationType="slide" transparent onRequestClose={clear}>
      <View flex={1} bg="rgba(0,0,0,0.65)" justify="flex-end" onPress={clear}>
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
        </YStack>
      </View>
    </Modal>
  );
}
