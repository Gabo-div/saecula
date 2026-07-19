import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Separator, Text, View, XStack, YStack } from 'tamagui';

import { HeaderIconButton, ScreenHeader } from '@/components/ScreenHeader';
import type { ProfileStackParamList } from '@/navigation/RootTabs';
import { useAuthStore } from '@/store/authStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

export function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const initial = (user?.email ?? 'S').charAt(0).toUpperCase();

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
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
          bg={c.bgElevated}
          borderWidth={3}
          borderColor={c.accent}
          items="center"
          justify="center"
        >
          <Text color={c.accent} fontFamily={serif} fontSize={40} fontWeight="700">
            {initial}
          </Text>
        </View>
        <Text color={c.strong} fontFamily={serif} fontSize={20}>
          {user?.email ?? ''}
        </Text>
      </YStack>

      <YStack px="$4" pt="$8" gap="$3">
        <Text color={c.muted} fontSize={11} letterSpacing={2}>
          {t('profile.account').toUpperCase()}
        </Text>
        <Separator borderColor={c.border} />

        <XStack
          items="center"
          gap="$3"
          py="$3"
          onPress={() => navigation.navigate('Settings')}
          pressStyle={{ opacity: 0.7 }}
        >
          <MaterialCommunityIcons name="cog-outline" size={22} color={c.accent} />
          <Text color={c.strong} fontSize={15}>
            {t('settings.title')}
          </Text>
          <View ml="auto">
            <MaterialCommunityIcons name="chevron-right" size={22} color={c.muted} />
          </View>
        </XStack>

        <XStack items="center" gap="$3" py="$3" onPress={logout} pressStyle={{ opacity: 0.7 }}>
          <MaterialCommunityIcons name="logout" size={22} color={c.error} />
          <Text color={c.error} fontSize={15}>
            {t('profile.signOut')}
          </Text>
        </XStack>
      </YStack>
    </View>
  );
}
