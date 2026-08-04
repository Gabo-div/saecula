import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, YStack } from 'tamagui';

import { ScreenHeader } from '@/components/ScreenHeader';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

export function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader title={t('explore.title')} />
      <YStack flex={1} items="center" justify="center" gap="$4" px="$8">
        <MaterialCommunityIcons name="compass-outline" size={56} color={c.accentDim} />
        <Text color={c.strong} fontFamily={serif} fontSize={22} text="center">
          {t('explore.comingTitle')}
        </Text>
        <Text color={c.muted} fontSize={14} text="center">
          {t('explore.comingBody')}
        </Text>
      </YStack>
    </View>
  );
}
