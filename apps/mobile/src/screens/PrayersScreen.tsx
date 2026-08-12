import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutAnimation, Platform, ScrollView, UIManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { ScreenHeader } from '@/components/ScreenHeader';
import type { RootTabParamList } from '@/navigation/RootTabs';
import { PRAYERS, type Prayer, type PrayerLang } from '@/data/prayers';
import { useLanguageStore } from '@/store/languageStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

type Props = BottomTabScreenProps<RootTabParamList, 'Prayers'>;
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
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function pick(rec: Record<PrayerLang, string>, lang: PrayerLang): string {
  return rec[lang] ?? rec.la ?? rec.en;
}

function PrayerCard({
  prayer,
  lang,
  open,
  onToggle,
}: {
  prayer: Prayer;
  lang: PrayerLang;
  open: boolean;
  onToggle: () => void;
}) {
  const c = useAppTheme();
  const title = pick(prayer.title, lang);
  // Show the Latin incipit as a subtitle for flavor, except when reading in Latin.
  const subtitle = lang === 'la' ? null : prayer.title.la;

  return (
    <YStack
      rounded="$8"
      bg={c.bgElevated}
      borderWidth={1}
      borderColor={open ? c.accentDim : c.border}
      overflow="hidden"
    >
      <XStack
        items="center"
        gap="$3"
        px="$4"
        py="$3"
        onPress={onToggle}
        pressStyle={{ opacity: 0.7 }}
      >
        <View
          width={38}
          height={38}
          rounded={19}
          bg={open ? c.accent : c.chip}
          items="center"
          justify="center"
        >
          <MaterialCommunityIcons
            name={ICONS[prayer.id] ?? 'hands-pray'}
            size={20}
            color={open ? c.bg : c.accent}
          />
        </View>
        <YStack flex={1}>
          <Text color={c.strong} fontFamily={serif} fontSize={17} fontWeight="600">
            {title}
          </Text>
          {subtitle && (
            <Text color={c.muted} fontSize={12} fontStyle="italic">
              {subtitle}
            </Text>
          )}
        </YStack>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={c.muted}
        />
      </XStack>

      {open && (
        <YStack px="$4" pb="$4" gap="$3">
          <View height={1} bg={c.border} />
          <Text color={c.text} fontFamily={serif} fontSize={16} lineHeight={27}>
            {pick(prayer.text, lang)}
          </Text>
        </YStack>
      )}
    </YStack>
  );
}

// A reader of traditional prayers as single-open accordion cards, in the
// active content language (falling back to Latin then English).
export function PrayersScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const lang: PrayerLang = LANGS.includes(language as PrayerLang)
    ? (language as PrayerLang)
    : 'en';

  const [openId, setOpenId] = useState<string>(PRAYERS[0]?.id ?? '');

  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenId((cur) => (cur === id ? '' : id));
  };

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader title={t('home.prayers')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {PRAYERS.map((p) => (
          <PrayerCard
            key={p.id}
            prayer={p}
            lang={lang}
            open={openId === p.id}
            onToggle={() => toggle(p.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
