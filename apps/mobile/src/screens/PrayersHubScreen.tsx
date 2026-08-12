import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { ScreenHeader } from '@/components/ScreenHeader';
import { GUIDED } from '@/data/guided';
import { PRAYERS, type PrayerLang } from '@/data/prayers';
import type { PrayersStackParamList } from '@/navigation/RootTabs';
import { useLanguageStore } from '@/store/languageStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

type Props = NativeStackScreenProps<PrayersStackParamList, 'PrayersHome'>;
type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const LANGS: PrayerLang[] = ['en', 'es', 'la'];

const ICONS: Record<string, IconName> = {
  'sign-of-the-cross': 'cross',
  'our-father': 'hands-pray',
  'hail-mary': 'flower-tulip-outline',
  'glory-be': 'white-balance-sunny',
  'apostles-creed': 'book-cross',
  'hail-holy-queen': 'crown-outline',
  'guardian-angel': 'shield-cross-outline',
  'act-of-contrition': 'heart-outline',
  rosary: 'circle-multiple-outline',
};

function pick(rec: Record<PrayerLang, string>, lang: PrayerLang): string {
  return rec[lang] ?? rec.la ?? rec.en;
}

function SectionLabel({ children }: { children: string }) {
  const c = useAppTheme();
  return (
    <Text fontSize={11} fontWeight="700" color={c.accent} letterSpacing={1.5}>
      {children.toUpperCase()}
    </Text>
  );
}

export function PrayersHubScreen({ navigation }: Props) {
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
      <ScrollView contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 32 }}>
        {/* Guided prayers — featured */}
        <YStack gap="$3">
          <SectionLabel>{t('prayers.guided')}</SectionLabel>
          {GUIDED.map((g) => (
            <XStack
              key={g.id}
              items="center"
              gap="$3"
              p="$4"
              rounded="$8"
              bg={c.card}
              onPress={() => navigation.navigate('GuidedPrayer', { guidedId: g.id })}
              pressStyle={{ opacity: 0.85 }}
            >
              <View width={46} height={46} rounded={23} bg="rgba(255,255,255,0.14)" items="center" justify="center">
                <MaterialCommunityIcons name={ICONS[g.id] ?? 'hands-pray'} size={26} color={c.onCard} />
              </View>
              <YStack flex={1}>
                <Text color={c.onCard} fontFamily={serif} fontSize={19} fontWeight="600">
                  {pick(g.title, lang)}
                </Text>
                <Text color={c.onCard} fontSize={12} opacity={0.8}>
                  {pick(g.subtitle, lang)}
                </Text>
              </YStack>
              <MaterialCommunityIcons name="chevron-right" size={24} color={c.onCard} />
            </XStack>
          ))}
        </YStack>

        {/* Individual prayers */}
        <YStack gap="$2">
          <SectionLabel>{t('prayers.individual')}</SectionLabel>
          {PRAYERS.map((p) => (
            <XStack
              key={p.id}
              items="center"
              gap="$3"
              py="$3"
              px="$3"
              rounded="$6"
              bg={c.bgElevated}
              borderWidth={1}
              borderColor={c.border}
              onPress={() => navigation.navigate('PrayerDetail', { prayerId: p.id })}
              pressStyle={{ opacity: 0.7 }}
            >
              <View width={36} height={36} rounded={18} bg={c.chip} items="center" justify="center">
                <MaterialCommunityIcons name={ICONS[p.id] ?? 'hands-pray'} size={19} color={c.accent} />
              </View>
              <YStack flex={1}>
                <Text color={c.strong} fontFamily={serif} fontSize={16} fontWeight="600">
                  {pick(p.title, lang)}
                </Text>
                {lang !== 'la' && (
                  <Text color={c.muted} fontSize={12} fontStyle="italic">
                    {p.title.la}
                  </Text>
                )}
              </YStack>
              <MaterialCommunityIcons name="chevron-right" size={22} color={c.muted} />
            </XStack>
          ))}
        </YStack>
      </ScrollView>
    </View>
  );
}
