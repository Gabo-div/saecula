import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Separator, Text, View, XStack, YStack } from 'tamagui';

import { HeaderIconButton, ScreenHeader } from '@/components/ScreenHeader';
import type { ProfileStackParamList } from '@/navigation/RootTabs';
import { useAuthStore } from '@/store/authStore';
import { colors, serif } from '@/theme/colors';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

export function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const initial = (user?.email ?? 'S').charAt(0).toUpperCase();

  return (
    <View flex={1} bg={colors.bg} pt={insets.top + 8}>
      <ScreenHeader
        title={t('profile.title')}
        right={
          <HeaderIconButton icon="cog-outline" onPress={() => navigation.navigate('Settings')} />
        }
      />

      <YStack items="center" pt="$8" gap="$3">
        <View
          width={96}
          height={96}
          rounded={48}
          bg={colors.bgElevated}
          borderWidth={3}
          borderColor={colors.gold}
          items="center"
          justify="center"
        >
          <Text color={colors.gold} fontFamily={serif} fontSize={40} fontWeight="700">
            {initial}
          </Text>
        </View>
        <Text color={colors.cream} fontFamily={serif} fontSize={20}>
          {user?.email ?? ''}
        </Text>
      </YStack>

      <YStack px="$4" pt="$8" gap="$3">
        <Text color={colors.textMuted} fontSize={11} letterSpacing={2}>
          {t('profile.account').toUpperCase()}
        </Text>
        <Separator borderColor={colors.border} />

        <XStack
          items="center"
          gap="$3"
          py="$3"
          onPress={() => navigation.navigate('Settings')}
          pressStyle={{ opacity: 0.7 }}
        >
          <MaterialCommunityIcons name="cog-outline" size={22} color={colors.gold} />
          <Text color={colors.cream} fontSize={15}>
            {t('settings.title')}
          </Text>
          <View ml="auto">
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
          </View>
        </XStack>

        <XStack items="center" gap="$3" py="$3" onPress={logout} pressStyle={{ opacity: 0.7 }}>
          <MaterialCommunityIcons name="logout" size={22} color={colors.error} />
          <Text color={colors.error} fontSize={15}>
            {t('profile.signOut')}
          </Text>
        </XStack>
      </YStack>
    </View>
  );
}
