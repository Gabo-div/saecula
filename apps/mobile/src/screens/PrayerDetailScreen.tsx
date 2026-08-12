import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { ScreenHeader } from '@/components/ScreenHeader';
import { PRAYERS, type PrayerLang } from '@/data/prayers';
import type { PrayersStackParamList } from '@/navigation/RootTabs';
import { useLanguageStore } from '@/store/languageStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

type Props = NativeStackScreenProps<PrayersStackParamList, 'PrayerDetail'>;
type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const LANGS: PrayerLang[] = ['en', 'es', 'la'];
const LANG_LABELS: Record<PrayerLang, string> = { en: 'English', es: 'Español', la: 'Latina' };

const ICONS: Record<string, IconName> = {
  'sign-of-the-cross': 'cross',
  'our-father': 'hands-pray',
  'hail-mary': 'flower-tulip-outline',
  'glory-be': 'white-balance-sunny',
  'apostles-creed': 'book-cross',
  'hail-holy-queen': 'crown-outline',
  'guardian-angel': 'shield-cross-outline',
  'act-of-contrition': 'heart-outline',
};

export function PrayerDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const appLang = useLanguageStore((s) => s.language);
  const prayer = PRAYERS.find((p) => p.id === route.params.prayerId);

  const [lang, setLang] = useState<PrayerLang>(
    LANGS.includes(appLang as PrayerLang) ? (appLang as PrayerLang) : 'en',
  );

  if (!prayer) {
    return (
      <View flex={1} bg={c.bg} pt={insets.top + 8}>
        <ScreenHeader title={t('home.prayers')} onBack={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader title={prayer.title[lang]} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <YStack items="center" gap="$3" mb="$5">
          <View width={64} height={64} rounded={32} bg={c.chip} items="center" justify="center">
            <MaterialCommunityIcons name={ICONS[prayer.id] ?? 'hands-pray'} size={34} color={c.accent} />
          </View>
          <Text color={c.strong} fontFamily={serif} fontSize={24} fontWeight="600" text="center">
            {prayer.title[lang]}
          </Text>
        </YStack>

        {/* Language selector */}
        <XStack self="center" mb="$5" rounded={22} bg={c.bgElevated} borderWidth={1} borderColor={c.border} p="$1">
          {LANGS.map((l) => {
            const active = l === lang;
            return (
              <View
                key={l}
                px="$4"
                py="$2"
                rounded={18}
                bg={active ? c.accent : 'transparent'}
                onPress={() => setLang(l)}
                pressStyle={{ opacity: 0.7 }}
              >
                <Text color={active ? c.bg : c.muted} fontSize={13} fontWeight={active ? '700' : '500'}>
                  {LANG_LABELS[l]}
                </Text>
              </View>
            );
          })}
        </XStack>

        <Text color={c.text} fontFamily={serif} fontSize={19} lineHeight={32} text="center">
          {prayer.text[lang]}
        </Text>
      </ScrollView>
    </View>
  );
}
