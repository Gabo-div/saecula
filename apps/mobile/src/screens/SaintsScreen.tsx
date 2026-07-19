import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, YStack } from 'tamagui';

import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, serif } from '@/theme/colors';

export function SaintsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View flex={1} bg={colors.bg} pt={insets.top + 8}>
      <ScreenHeader title={t('saints.title')} />
      <YStack flex={1} items="center" justify="center" gap="$4" px="$8">
        <MaterialCommunityIcons name="account-heart-outline" size={56} color={colors.goldDim} />
        <Text color={colors.cream} fontFamily={serif} fontSize={22} text="center">
          {t('saints.comingTitle')}
        </Text>
        <Text color={colors.textMuted} fontSize={14} text="center">
          {t('saints.comingBody')}
        </Text>
      </YStack>
    </View>
  );
}
