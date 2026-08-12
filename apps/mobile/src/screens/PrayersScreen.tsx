import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, YStack } from 'tamagui';

import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootTabParamList } from '@/navigation/RootTabs';
import { PRAYERS, type PrayerLang } from '@/data/prayers';
import { useLanguageStore } from '@/store/languageStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

type Props = BottomTabScreenProps<RootTabParamList, 'Prayers'>;

const LANGS: PrayerLang[] = ['en', 'es', 'la'];

// A static reader of traditional prayers in the active content language,
// falling back to Latin then English if a translation is missing.
export function PrayersScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const lang: PrayerLang = LANGS.includes(language as PrayerLang)
    ? (language as PrayerLang)
    : 'en';

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader title={t('home.prayers')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 28, paddingBottom: 32 }}>
        {PRAYERS.map((p) => (
          <YStack key={p.id} gap="$2">
            <Text color={c.accent} fontFamily={serif} fontSize={18} fontWeight="600">
              {p.title[lang] ?? p.title.la ?? p.title.en}
            </Text>
            <Text color={c.text} fontFamily={serif} fontSize={16} lineHeight={26}>
              {p.text[lang] ?? p.text.la ?? p.text.en}
            </Text>
          </YStack>
        ))}
      </ScrollView>
    </View>
  );
}
