import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutAnimation, Platform, ScrollView, UIManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { ScreenHeader } from '@/components/ScreenHeader';
import { GUIDED, MYSTERY_SETS, type GuidedStep } from '@/data/guided';
import { PRAYERS, type PrayerLang } from '@/data/prayers';
import type { PrayersStackParamList } from '@/navigation/RootTabs';
import { useLanguageStore } from '@/store/languageStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

type Props = NativeStackScreenProps<PrayersStackParamList, 'GuidedPrayer'>;

const LANGS: PrayerLang[] = ['en', 'es', 'la'];
const LANG_LABELS: Record<PrayerLang, string> = { en: 'English', es: 'Español', la: 'Latina' };

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function pick(rec: Record<PrayerLang, string>, lang: PrayerLang): string {
  return rec[lang] ?? rec.la ?? rec.en;
}

function stepText(step: GuidedStep, lang: PrayerLang): string {
  if (step.prayerId) {
    const p = PRAYERS.find((x) => x.id === step.prayerId);
    if (p) return p.text[lang] ?? p.text.la ?? p.text.en;
  }
  return step.body ? pick(step.body, lang) : '';
}

function StepRow({ step, lang }: { step: GuidedStep; lang: PrayerLang }) {
  const c = useAppTheme();
  const [open, setOpen] = useState(false);
  const text = stepText(step, lang);

  return (
    <YStack rounded="$6" bg={c.bgElevated} borderWidth={1} borderColor={c.border} overflow="hidden">
      <XStack
        items="center"
        gap="$3"
        px="$3"
        py="$3"
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((v) => !v);
        }}
        pressStyle={{ opacity: 0.7 }}
      >
        <Text color={c.strong} fontFamily={serif} fontSize={15} flex={1}>
          {pick(step.label, lang)}
        </Text>
        {step.repeat ? (
          <View px="$2" py="$1" rounded={10} bg={c.chip}>
            <Text color={c.accent} fontSize={12} fontWeight="700">
              ×{step.repeat}
            </Text>
          </View>
        ) : null}
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={c.muted} />
      </XStack>
      {open && text ? (
        <YStack px="$3" pb="$3" gap="$2">
          <View height={1} bg={c.border} />
          <Text color={c.text} fontFamily={serif} fontSize={15} lineHeight={25}>
            {text}
          </Text>
        </YStack>
      ) : null}
    </YStack>
  );
}

export function GuidedPrayerScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const appLang = useLanguageStore((s) => s.language);
  const guided = GUIDED.find((g) => g.id === route.params.guidedId);

  const [lang, setLang] = useState<PrayerLang>(
    LANGS.includes(appLang as PrayerLang) ? (appLang as PrayerLang) : 'en',
  );

  // The mystery set traditionally prayed on today's weekday.
  const todaySet = useMemo(() => {
    const dow = new Date().getUTCDay();
    return MYSTERY_SETS.find((s) => s.days.includes(dow)) ?? MYSTERY_SETS[0];
  }, []);

  if (!guided) {
    return (
      <View flex={1} bg={c.bg} pt={insets.top + 8}>
        <ScreenHeader title={t('home.prayers')} onBack={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader title={guided.title[lang]} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}>
        <Text color={c.text} fontFamily={serif} fontSize={15} lineHeight={24}>
          {pick(guided.intro, lang)}
        </Text>

        {/* Language selector */}
        <XStack self="center" rounded={22} bg={c.bgElevated} borderWidth={1} borderColor={c.border} p="$1">
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

        {/* Today's mysteries */}
        <YStack gap="$3" p="$4" rounded="$8" bg={c.card}>
          <Text color={c.onCard} fontSize={11} letterSpacing={2} fontWeight="700">
            {t('prayers.todaysMysteries').toUpperCase()}
          </Text>
          <Text color={c.onCard} fontFamily={serif} fontSize={18} fontWeight="600">
            {pick(todaySet.name, lang)}
          </Text>
          <YStack gap="$2">
            {todaySet.mysteries.map((m, i) => (
              <XStack key={i} gap="$2" items="baseline">
                <Text color={c.onCard} fontFamily={serif} fontSize={13} opacity={0.7} width={20}>
                  {i + 1}.
                </Text>
                <Text color={c.onCard} fontFamily={serif} fontSize={15} flex={1}>
                  {pick(m.title, lang)}
                </Text>
              </XStack>
            ))}
          </YStack>
        </YStack>

        {/* Order of prayer */}
        <YStack gap="$3">
          <Text fontSize={11} fontWeight="700" color={c.accent} letterSpacing={1.5}>
            {t('prayers.order').toUpperCase()}
          </Text>
          {guided.opening.map((s, i) => (
            <StepRow key={`o-${i}`} step={s} lang={lang} />
          ))}

          <Text color={c.muted} fontSize={13} fontStyle="italic" mt="$1">
            {t('prayers.forEachMystery')}:
          </Text>
          {guided.decade.map((s, i) => (
            <StepRow key={`d-${i}`} step={s} lang={lang} />
          ))}

          {guided.closing.map((s, i) => (
            <StepRow key={`c-${i}`} step={s} lang={lang} />
          ))}
        </YStack>
      </ScrollView>
    </View>
  );
}
