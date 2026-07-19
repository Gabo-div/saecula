import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Separator, Text, View, XStack, YStack } from 'tamagui';

import { fetchTranslations } from '@/api/client';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import type { ProfileStackParamList } from '@/navigation/RootTabs';
import { useLanguageStore } from '@/store/languageStore';
import { useReaderStore } from '@/store/readerStore';
import { useAppTheme, useThemeStore } from '@/store/themeStore';
import type { ThemeColor, ThemeMode } from '@/theme/colors';
import { ACCENT_KEYS, ACCENTS, serif } from '@/theme/colors';
import type { Translation } from '@/types/api';

// Native language names never get translated — you should always be able
// to find your own language.
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Español',
  la: 'Latina',
};

type Props = NativeStackScreenProps<ProfileStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppTheme();
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const translationId = useReaderStore((s) => s.translationId);
  const setTranslation = useReaderStore((s) => s.setTranslation);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const accent = useThemeStore((s) => s.accent);
  const setAccent = useThemeStore((s) => s.setAccent);

  const [translations, setTranslations] = useState<Translation[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        setTranslations((await fetchTranslations()).translations);
      } catch {
        setTranslations([]);
      }
    })();
  }, []);

  return (
    <View flex={1} bg={c.bg} pt={insets.top + 8}>
      <XStack items="center" gap="$3" px="$4" py="$2">
        <MaterialCommunityIcons
          name="chevron-left"
          size={28}
          color={c.accent}
          onPress={() => navigation.goBack()}
        />
        <Text
          color={c.accent}
          fontFamily={serif}
          fontSize={17}
          letterSpacing={3}
          fontWeight="600"
        >
          {t('settings.title').toUpperCase()}
        </Text>
      </XStack>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Theme mode */}
        <YStack px="$4" pt="$6" gap="$3">
          <Text color={c.muted} fontSize={11} letterSpacing={2}>
            {t('settings.theme').toUpperCase()}
          </Text>
          <Separator borderColor={c.border} />

          {(['dark', 'amoled', 'light'] as ThemeMode[]).map((m) => {
            const active = mode === m;
            return (
              <XStack
                key={m}
                items="center"
                gap="$3"
                py="$3"
                onPress={() => setMode(m)}
                pressStyle={{ opacity: 0.7 }}
              >
                <MaterialCommunityIcons
                  name={
                    m === 'dark'
                      ? 'weather-night'
                      : m === 'amoled'
                        ? 'moon-waning-crescent'
                        : 'white-balance-sunny'
                  }
                  size={20}
                  color={active ? c.accent : c.muted}
                />
                <Text color={active ? c.accent : c.strong} fontSize={15}>
                  {t(
                    m === 'dark'
                      ? 'settings.dark'
                      : m === 'amoled'
                        ? 'settings.amoled'
                        : 'settings.light',
                  )}
                </Text>
                {active && (
                  <View ml="auto">
                    <MaterialCommunityIcons name="check" size={20} color={c.accent} />
                  </View>
                )}
              </XStack>
            );
          })}
        </YStack>

        {/* Accent color (liturgical palette) */}
        <YStack px="$4" pt="$8" gap="$3">
          <Text color={c.muted} fontSize={11} letterSpacing={2}>
            {t('settings.accent').toUpperCase()}
          </Text>
          <Separator borderColor={c.border} />

          <XStack gap="$3" py="$2" flexWrap="wrap">
            {ACCENT_KEYS.map((key) => {
              const swatch: ThemeColor = ACCENTS[key][mode === 'light' ? 'light' : 'dark'].base;
              const active = accent === key;
              return (
                <View
                  key={key}
                  width={44}
                  height={44}
                  rounded={22}
                  bg={swatch}
                  borderWidth={3}
                  borderColor={active ? c.strong : 'transparent'}
                  items="center"
                  justify="center"
                  onPress={() => setAccent(key)}
                  pressStyle={{ opacity: 0.8 }}
                >
                  {active && <MaterialCommunityIcons name="check" size={20} color="#fff" />}
                </View>
              );
            })}
          </XStack>
        </YStack>

        <YStack px="$4" pt="$8" gap="$3">
          <Text color={c.muted} fontSize={11} letterSpacing={2}>
            {t('settings.language').toUpperCase()}
          </Text>
          <Separator borderColor={c.border} />

          {SUPPORTED_LANGUAGES.map((code) => {
            const active = language === code;
            return (
              <XStack
                key={code}
                items="center"
                gap="$3"
                py="$3"
                onPress={() => setLanguage(code)}
                pressStyle={{ opacity: 0.7 }}
              >
                <Text color={active ? c.accent : c.strong} fontSize={15}>
                  {LANGUAGE_NAMES[code] ?? code}
                </Text>
                <Text color={c.muted} fontSize={12}>
                  {code.toUpperCase()}
                </Text>
                {active && (
                  <View ml="auto">
                    <MaterialCommunityIcons name="check" size={20} color={c.accent} />
                  </View>
                )}
              </XStack>
            );
          })}
        </YStack>

        {/* App-wide Bible edition (readerStore.translationId → every ?translation=) */}
        <YStack px="$4" pt="$8" gap="$3">
          <Text color={c.muted} fontSize={11} letterSpacing={2}>
            {t('settings.translation').toUpperCase()}
          </Text>
          <Separator borderColor={c.border} />

          <XStack
            items="center"
            gap="$3"
            py="$3"
            onPress={() => setTranslation('')}
            pressStyle={{ opacity: 0.7 }}
          >
            <Text color={translationId === '' ? c.accent : c.strong} fontSize={15}>
              {t('settings.defaultTranslation')}
            </Text>
            {translationId === '' && (
              <View ml="auto">
                <MaterialCommunityIcons name="check" size={20} color={c.accent} />
              </View>
            )}
          </XStack>

          {translations.map((tr) => {
            const active = translationId === tr.id;
            return (
              <XStack
                key={`${tr.id}-${tr.language_code}`}
                items="center"
                gap="$3"
                py="$3"
                onPress={() => setTranslation(tr.id)}
                pressStyle={{ opacity: 0.7 }}
              >
                <Text color={active ? c.accent : c.strong} fontSize={15}>
                  {tr.id.replace(/_/g, ' ').toUpperCase()}
                </Text>
                <Text color={c.muted} fontSize={12}>
                  {tr.language_code.toUpperCase()}
                </Text>
                {active && (
                  <View ml="auto">
                    <MaterialCommunityIcons name="check" size={20} color={c.accent} />
                  </View>
                )}
              </XStack>
            );
          })}
        </YStack>
      </ScrollView>
    </View>
  );
}
