import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, XStack, YStack } from 'tamagui';

import { ScreenHeader } from '@/components/ScreenHeader';
import { GUIDED, MYSTERY_SETS, type GuidedStep, type MysterySet } from '@/data/guided';
import { PRAYERS, type PrayerLang } from '@/data/prayers';
import type { PrayersStackParamList } from '@/navigation/RootTabs';
import { useLanguageStore } from '@/store/languageStore';
import { useAppTheme } from '@/store/themeStore';
import { serif } from '@/theme/colors';

type Props = NativeStackScreenProps<PrayersStackParamList, 'GuidedPrayer'>;

const LANGS: PrayerLang[] = ['en', 'es', 'la'];
const LANG_LABELS: Record<PrayerLang, string> = { en: 'English', es: 'Español', la: 'Latina' };

function pick(rec: Record<PrayerLang, string>, lang: PrayerLang): string {
  return rec[lang] ?? rec.la ?? rec.en;
}

interface FlatStep {
  section: string; // contextual line above the step
  label: string;
  text: string; // prayer text, or '' for a mystery announcement
  beads: number; // how many times it is prayed (1, 3, 10)
}

function stepText(step: GuidedStep, lang: PrayerLang): string {
  if (step.prayerId) {
    const p = PRAYERS.find((x) => x.id === step.prayerId);
    if (p) return p.text[lang] ?? p.text.la ?? p.text.en;
  }
  return step.body ? pick(step.body, lang) : '';
}

// Flatten the Rosary into the actual order prayed: opening, then the five
// decades (each announced), then the closing — with bead counts intact.
function buildSequence(set: MysterySet, lang: string, orderLabel: string): FlatStep[] {
  const l = (LANGS.includes(lang as PrayerLang) ? lang : 'en') as PrayerLang;
  const rosary = GUIDED[0];
  const out: FlatStep[] = [];
  for (const s of rosary.opening) {
    out.push({ section: orderLabel, label: pick(s.label, l), text: stepText(s, l), beads: s.repeat ?? 1 });
  }
  set.mysteries.forEach((m, i) => {
    const setName = pick(set.name, l);
    out.push({ section: setName, label: `${i + 1}. ${pick(m.title, l)}`, text: '', beads: 1 });
    for (const s of rosary.decade) {
      out.push({ section: pick(m.title, l), label: pick(s.label, l), text: stepText(s, l), beads: s.repeat ?? 1 });
    }
  });
  for (const s of rosary.closing) {
    out.push({ section: pick(set.name, l), label: pick(s.label, l), text: stepText(s, l), beads: s.repeat ?? 1 });
  }
  return out;
}

export function GuidedPrayerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const appLang = useLanguageStore((s) => s.language);
  const headerLang: PrayerLang = LANGS.includes(appLang as PrayerLang)
    ? (appLang as PrayerLang)
    : 'en';

  const rosary = GUIDED[0];
  const [lang, setLang] = useState<PrayerLang>(headerLang);

  const todaySet = useMemo(() => {
    const dow = new Date().getUTCDay();
    return MYSTERY_SETS.find((s) => s.days.includes(dow)) ?? MYSTERY_SETS[0];
  }, []);
  const [setId, setSetId] = useState(todaySet.id);
  const set = MYSTERY_SETS.find((s) => s.id === setId) ?? todaySet;

  const [started, setStarted] = useState(false);
  const [pos, setPos] = useState(0);
  const [bead, setBead] = useState(1);

  const seq = useMemo(
    () => buildSequence(set, lang, t('prayers.order')),
    [set, lang, t],
  );

  const begin = () => {
    setPos(0);
    setBead(1);
    setStarted(true);
  };

  const advance = () => {
    const step = seq[pos];
    if (step && step.beads > 1 && bead < step.beads) setBead(bead + 1);
    else {
      setPos(pos + 1);
      setBead(1);
    }
  };

  const back = () => {
    if (bead > 1) setBead(bead - 1);
    else if (pos > 0) {
      setPos(pos - 1);
      setBead(1);
    }
  };

  const title = rosary.title[headerLang];

  // -- Overview: pick the mysteries + language, then begin. -----------------
  if (!started) {
    return (
      <View flex={1} bg={c.bg} pt={insets.top + 8}>
        <ScreenHeader title={title} onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}>
          <Text color={c.text} fontFamily={serif} fontSize={15} lineHeight={24}>
            {pick(rosary.intro, lang)}
          </Text>

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

          {/* Mystery set chooser */}
          <XStack gap="$2" flexWrap="wrap" justify="center">
            {MYSTERY_SETS.map((s) => {
              const active = s.id === setId;
              return (
                <View
                  key={s.id}
                  px="$3"
                  py="$2"
                  rounded={18}
                  bg={active ? c.accent : 'transparent'}
                  borderWidth={1}
                  borderColor={active ? c.accent : c.border}
                  onPress={() => setSetId(s.id)}
                  pressStyle={{ opacity: 0.7 }}
                >
                  <Text color={active ? c.bg : c.strong} fontSize={13}>
                    {pick(s.name, lang)}
                  </Text>
                </View>
              );
            })}
          </XStack>

          {/* Selected mysteries */}
          <YStack gap="$3" p="$4" rounded="$8" bg={c.card}>
            <Text color={c.onCard} fontSize={11} letterSpacing={2} fontWeight="700">
              {(set.id === todaySet.id ? t('prayers.todaysMysteries') : pick(set.name, lang)).toUpperCase()}
            </Text>
            <YStack gap="$2">
              {set.mysteries.map((m, i) => (
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

          <XStack
            items="center"
            justify="center"
            gap="$2"
            py="$3"
            rounded="$8"
            bg={c.accent}
            onPress={begin}
            pressStyle={{ opacity: 0.85 }}
          >
            <MaterialCommunityIcons name="play" size={20} color={c.bg} />
            <Text color={c.bg} fontSize={15} fontWeight="700">
              {t('prayers.begin')}
            </Text>
          </XStack>
        </ScrollView>
      </View>
    );
  }

  // -- Finished -------------------------------------------------------------
  if (pos >= seq.length) {
    return (
      <View flex={1} bg={c.bg} pt={insets.top + 8}>
        <ScreenHeader title={title} onBack={() => navigation.goBack()} />
        <YStack flex={1} items="center" justify="center" gap="$4" px="$8">
          <View width={80} height={80} rounded={40} bg={c.card} items="center" justify="center">
            <MaterialCommunityIcons name="check" size={44} color={c.onCard} />
          </View>
          <Text color={c.strong} fontFamily={serif} fontSize={22} fontWeight="600" text="center">
            {t('prayers.finished')}
          </Text>
          <XStack
            items="center"
            gap="$2"
            px="$5"
            py="$3"
            rounded="$8"
            bg={c.accent}
            onPress={begin}
            pressStyle={{ opacity: 0.85 }}
          >
            <MaterialCommunityIcons name="restart" size={18} color={c.bg} />
            <Text color={c.bg} fontSize={14} fontWeight="700">
              {t('prayers.again')}
            </Text>
          </XStack>
        </YStack>
      </View>
    );
  }

  // -- Player: one step at a time. ------------------------------------------
  const step = seq[pos];
  const progress = pos / seq.length;

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />

      {/* Progress */}
      <YStack px="$4" pt="$1" pb="$3" gap="$2">
        <View height={4} rounded={2} bg={c.bgElevated} overflow="hidden">
          <View height={4} rounded={2} bg={c.accent} width={`${Math.round(progress * 100)}%`} />
        </View>
        <Text color={c.muted} fontSize={11} letterSpacing={1}>
          {pos + 1} / {seq.length}
          {step.section ? `  ·  ${step.section}` : ''}
        </Text>
      </YStack>

      {/* Step body — tapping anywhere advances (bead by bead). */}
      <View flex={1} onPress={advance} pressStyle={{ opacity: 0.95 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24, flexGrow: 1 }}>
          <Text color={c.strong} fontFamily={serif} fontSize={24} fontWeight="600" mb="$4">
            {step.label}
          </Text>

          {step.beads > 1 && (
            <XStack items="center" gap="$3" mb="$4" flexWrap="wrap">
              <Text color={c.accent} fontSize={15} fontWeight="700">
                {bead} / {step.beads}
              </Text>
              <XStack gap="$1" flexWrap="wrap" flex={1}>
                {Array.from({ length: step.beads }, (_, i) => (
                  <View
                    key={i}
                    width={12}
                    height={12}
                    rounded={6}
                    bg={i < bead ? c.accent : 'transparent'}
                    borderWidth={1}
                    borderColor={i < bead ? c.accent : c.border}
                  />
                ))}
              </XStack>
            </XStack>
          )}

          {step.text ? (
            <Text color={c.text} fontFamily={serif} fontSize={19} lineHeight={32}>
              {step.text}
            </Text>
          ) : (
            <Text color={c.muted} fontFamily={serif} fontSize={16} fontStyle="italic">
              {pick(set.name, lang)}
            </Text>
          )}
        </ScrollView>
      </View>

      {/* Controls */}
      <XStack
        items="center"
        justify="space-between"
        px="$4"
        py="$3"
        pb={insets.bottom + 8}
        borderTopWidth={1}
        borderTopColor={c.border}
      >
        <View
          width={52}
          height={52}
          rounded={26}
          bg={c.bgElevated}
          borderWidth={1}
          borderColor={c.border}
          items="center"
          justify="center"
          opacity={pos === 0 && bead === 1 ? 0.4 : 1}
          onPress={back}
          pressStyle={{ opacity: 0.7 }}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={c.accent} />
        </View>
        <View
          flex={1}
          mx="$3"
          height={52}
          rounded={26}
          bg={c.accent}
          items="center"
          justify="center"
          onPress={advance}
          pressStyle={{ opacity: 0.85 }}
        >
          <MaterialCommunityIcons name="chevron-right" size={30} color={c.bg} />
        </View>
      </XStack>
    </View>
  );
}
